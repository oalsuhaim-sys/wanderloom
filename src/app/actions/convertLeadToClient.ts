'use server';

import { revalidatePath } from 'next/cache';

import {
  assertUsableLeadClientFields,
  canonicalizePhoneWa,
  isUsableClientName,
  isUsableClientPhone,
} from '@/lib/client-intake-pipeline';
import {
  ensureLeadClientIntakeAdmin,
  findClientIdByPhoneAdmin,
  reclaimClientIdAfterUniqueConflict,
} from '@/lib/client-intake-pipeline-server';
import { DEFAULT_SALES_STAGE } from '@/lib/client-sales-stage';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type ConvertLeadToClientResult =
  | { ok: true; clientId: number; reusedExisting: boolean; message: string }
  | { ok: false; error: string };

/** Optional UI snapshot — used when DB lead fields are incomplete or select fails. */
export type ConvertLeadSnapshot = {
  full_name?: string | null;
  phone_wa?: string | null;
  email?: string | null;
  destinations?: string[] | null;
};

function formatDbError(error: unknown): string {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [e.message, e.details, e.hint, e.code ? `code=${e.code}` : '']
      .filter(Boolean)
      .join(' | ');
  }
  return String(error);
}

/** Coerce Supabase id (number | numeric string) — Number.isFinite rejects strings. */
function coerceClientId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function pickLeadName(row: Record<string, unknown>): string {
  for (const key of ['full_name', 'name', 'client_name', 'customer_name']) {
    const v = String(row[key] ?? '').trim();
    if (isUsableClientName(v)) return v;
  }
  return '';
}

function pickLeadPhone(row: Record<string, unknown>): string {
  for (const key of ['phone_wa', 'phone', 'whatsapp', 'mobile', 'phone_number']) {
    const v = String(row[key] ?? '').trim();
    if (isUsableClientPhone(v)) return canonicalizePhoneWa(v) || v;
  }
  return '';
}

/**
 * Hard proof that a clients row exists and is listable (has id + name).
 * Prevents "ghost" conversions where the lead is marked converted but the client is invisible.
 */
async function verifyClientRowExists(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientId: number,
): Promise<{ id: number; name: string; phone_wa: string | null } | null> {
  const { data, error } = await admin
    .from('clients')
    .select('id, name, phone_wa')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    console.error('[convertLeadToClient] verify select failed:', formatDbError(error));
    throw new Error(`تعذر التحقق من صف العميل بعد الإنشاء: ${formatDbError(error)}`);
  }

  if (!data?.id) return null;

  const name = String((data as { name?: unknown }).name ?? '').trim();
  const phone = String((data as { phone_wa?: unknown }).phone_wa ?? '').trim() || null;
  if (!name) {
    const healName = phone ? `ضيف ${phone.slice(-4)}` : `عميل #${clientId}`;
    const heal = await admin
      .from('clients')
      .update({ name: healName })
      .eq('id', clientId)
      .select('id, name, phone_wa')
      .maybeSingle();
    if (heal.error || !heal.data) {
      console.error('[convertLeadToClient] name heal failed:', heal.error);
      return null;
    }
    return {
      id: Number(heal.data.id),
      name: String((heal.data as { name?: unknown }).name ?? healName),
      phone_wa: String((heal.data as { phone_wa?: unknown }).phone_wa ?? '').trim() || null,
    };
  }

  return {
    id: Number(data.id),
    name,
    phone_wa: phone,
  };
}

/**
 * Progressive insert with safe defaults.
 * On unique_phone_wa: reclaim existing client via multi-format phone lookup.
 */
async function insertClientWithDefaults(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  input: { name: string; phone: string; email: string | null },
): Promise<number> {
  const sanitizedPhone = String(input.phone ?? '').trim();
  const preExisting = await findClientIdByPhoneAdmin(admin, sanitizedPhone);
  if (preExisting) return preExisting;

  const attempts: Record<string, unknown>[] = [
    {
      name: input.name,
      phone_wa: sanitizedPhone,
      email: input.email,
      client_type: 'عميل',
      client_tier: 'regular',
      sales_stage: DEFAULT_SALES_STAGE,
      total_trips: 0,
      referrals_count: 0,
      lead_source: 'interest_list',
      vip_tier: 'gold',
      total_spent: 0,
      wallet_balance: 0,
      is_influencer: false,
      is_leader: false,
      onboarding_completed: false,
    },
    {
      name: input.name,
      phone_wa: sanitizedPhone,
      email: input.email,
      client_type: 'عميل',
      client_tier: 'regular',
      sales_stage: DEFAULT_SALES_STAGE,
      total_trips: 0,
      lead_source: 'interest_list',
    },
    {
      name: input.name,
      phone_wa: sanitizedPhone,
      email: input.email,
      client_type: 'عميل',
      sales_stage: DEFAULT_SALES_STAGE,
    },
    {
      name: input.name,
      phone_wa: sanitizedPhone,
      client_type: 'عميل',
      sales_stage: DEFAULT_SALES_STAGE,
    },
    { name: input.name, phone_wa: sanitizedPhone, client_type: 'عميل' },
    { name: input.name, phone_wa: sanitizedPhone },
  ];

  const errors: string[] = [];

  for (const payload of attempts) {
    const { data: newClient, error } = await admin
      .from('clients')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      const msg = formatDbError(error);
      console.error('[convertLeadToClient] clients.insert failed:', msg, payload);
      errors.push(msg);

      if (/duplicate|unique|23505|unique_phone_wa/i.test(msg)) {
        const existingId = await reclaimClientIdAfterUniqueConflict(
          admin,
          sanitizedPhone,
          (error ?? {}) as { message?: string; details?: string | null; hint?: string | null },
        );
        if (existingId) return existingId;

        const { data: exact } = await admin
          .from('clients')
          .select('id')
          .eq('phone_wa', sanitizedPhone)
          .maybeSingle();
        const exactId = coerceClientId(exact?.id);
        if (exactId) return exactId;

        await new Promise((r) => setTimeout(r, 80));
        const retryId = await reclaimClientIdAfterUniqueConflict(
          admin,
          sanitizedPhone,
          (error ?? {}) as { message?: string; details?: string | null; hint?: string | null },
        );
        if (retryId) return retryId;

        throw new Error(
          `رقم الجوال مسجّل مسبقاً لكن تعذر استرجاع ملف العميل. ابحث يدوياً في قاعدة العملاء عن: ${sanitizedPhone}`,
        );
      }

      if (/column|schema cache|does not exist|check constraint|null value/i.test(msg)) {
        continue;
      }

      throw new Error(`فشل إدراج العميل في جدول clients: ${msg}`);
    }

    const id = coerceClientId(newClient?.id);
    if (id) return id;

    console.error(
      '[convertLeadToClient] insert succeeded but returned no id:',
      newClient,
      payload,
    );
    errors.push('insert returned null id after .select().single()');
  }

  const lastChance = await findClientIdByPhoneAdmin(admin, sanitizedPhone);
  if (lastChance) return lastChance;

  throw new Error(
    `فشل إدراج العميل في جدول clients: ${errors.filter(Boolean).join(' ← ') || 'insert failed'}`,
  );
}

/** Find existing client by phone, otherwise insert. Never fails solely on unique_phone_wa. */
async function findOrCreateClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  input: { name: string; phone: string; email: string | null },
): Promise<{ clientId: number; reusedExisting: boolean }> {
  const existingId = await findClientIdByPhoneAdmin(admin, input.phone);
  if (existingId) {
    return { clientId: existingId, reusedExisting: true };
  }

  const clientId = await insertClientWithDefaults(admin, input);
  // insert may have reclaimed an existing row on race
  const after = await findClientIdByPhoneAdmin(admin, input.phone);
  if (after && after !== clientId) {
    return { clientId: after, reusedExisting: true };
  }
  // If reclaim returned same id we can't know if new — treat as new when we didn't find before insert
  return { clientId, reusedExisting: false };
}

function revalidateClientPaths(clientId: number) {
  revalidatePath('/crm/clients');
  revalidatePath(`/crm/clients/${clientId}`);
  revalidatePath('/crm/radar');
  revalidatePath('/crm');
  revalidatePath('/crm', 'layout');
  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard');
}

/**
 * Converts a lead into an official `clients` row.
 * Find-or-create by phone_wa — reuses existing clients instead of failing on unique_phone_wa.
 * Optional `snapshot` fills name/phone when the DB row is thin or partially unreadable.
 */
export async function convertLeadToClient(
  leadId: string,
  snapshot?: ConvertLeadSnapshot | null,
): Promise<ConvertLeadToClientResult> {
  const id = String(leadId ?? '').trim();
  if (!id) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const admin = createSupabaseAdminClient();
  let leadRow: Record<string, unknown> | null = null;

  try {
    const safe = await admin
      .from('leads')
      .select('id, full_name, phone_wa, email, status, client_id, destinations')
      .eq('id', id)
      .maybeSingle();

    if (!safe.error && safe.data) {
      leadRow = safe.data as Record<string, unknown>;
    } else {
      const all = await admin.from('leads').select('*').eq('id', id).maybeSingle();
      if (all.error) {
        console.error('[convertLeadToClient] lead read:', formatDbError(all.error));
        // Fall through to snapshot if we have usable UI fields
        if (!snapshot?.full_name && !snapshot?.phone_wa) {
          throw new Error(all.error.message || 'تعذر قراءة الطلب.');
        }
      } else if (!all.data) {
        if (!snapshot?.full_name && !snapshot?.phone_wa) {
          throw new Error('لم يُعثر على الطلب.');
        }
      } else {
        leadRow = all.data as Record<string, unknown>;
      }
    }

    const merged: Record<string, unknown> = {
      ...(leadRow ?? { id }),
      full_name: pickLeadName(leadRow ?? {}) || String(snapshot?.full_name ?? '').trim(),
      phone_wa: pickLeadPhone(leadRow ?? {}) || String(snapshot?.phone_wa ?? '').trim(),
      email:
        String(leadRow?.email ?? '').trim() ||
        String(snapshot?.email ?? '').trim() ||
        null,
      destinations:
        Array.isArray(leadRow?.destinations) && (leadRow?.destinations as unknown[]).length
          ? leadRow?.destinations
          : Array.isArray(snapshot?.destinations)
            ? snapshot?.destinations
            : [],
    };

    const name = pickLeadName(merged);
    const phone = pickLeadPhone(merged);
    const email = String(merged.email ?? '').trim() || null;
    assertUsableLeadClientFields({ name, phone });

    let clientId: number | null = null;
    let reusedExisting = false;

    // Already linked on the lead?
    const linkedId = coerceClientId(merged.client_id ?? leadRow?.client_id);
    if (linkedId) {
      const linked = await verifyClientRowExists(admin, linkedId);
      if (linked) {
        clientId = linked.id;
        reusedExisting = true;
      }
    }

    // FIND first — same phone already in clients
    if (!clientId) {
      const byPhone = await findClientIdByPhoneAdmin(admin, phone);
      if (byPhone) {
        clientId = byPhone;
        reusedExisting = true;
      }
    }

    // Intake helper (create or reuse)
    if (!clientId) {
      try {
        const ensured = await ensureLeadClientIntakeAdmin(id);
        clientId = coerceClientId(ensured.clientId);
        reusedExisting = ensured.reusedExisting;
        if (!clientId) {
          console.error(
            '[convertLeadToClient] ensure returned unusable clientId:',
            ensured.clientId,
          );
        }
      } catch (ensureErr) {
        console.warn(
          '[convertLeadToClient] ensureLeadClientIntakeAdmin failed — find-or-create:',
          ensureErr instanceof Error ? ensureErr.message : ensureErr,
        );
      }
    }

    if (!clientId) {
      const created = await findOrCreateClient(admin, { name, phone, email });
      clientId = created.clientId;
      reusedExisting = created.reusedExisting;
    }

    if (!clientId) {
      throw new Error(
        'تعذر الحصول على معرّف عميل صالح بعد الإدراج. تحقق من أعمدة جدول clients في Supabase.',
      );
    }

    let verified = await verifyClientRowExists(admin, clientId);
    if (!verified) {
      console.error(
        '[convertLeadToClient] verified client missing — reclaim by phone. clientId=',
        clientId,
      );
      const byPhone = await findClientIdByPhoneAdmin(admin, phone);
      if (byPhone) {
        clientId = byPhone;
        reusedExisting = true;
        verified = await verifyClientRowExists(admin, clientId);
      }
      if (!verified) {
        const created = await findOrCreateClient(admin, { name, phone, email });
        clientId = created.clientId;
        reusedExisting = created.reusedExisting;
        verified = await verifyClientRowExists(admin, clientId);
      }
    }

    if (!verified) {
      throw new Error(
        'فشل التحقق: صف العميل غير موجود في جدول clients بعد الإدراج. لم يتم تحديث حالة الطلب.',
      );
    }

    if (!reusedExisting) {
      await admin
        .from('clients')
        .update({
          sales_stage: DEFAULT_SALES_STAGE,
          client_type: 'عميل',
          lead_source: 'interest_list',
        })
        .eq('id', verified.id)
        .then(({ error }) => {
          if (
            error &&
            !/column|schema cache|does not exist|check constraint/i.test(error.message ?? '')
          ) {
            console.warn('[convertLeadToClient] defaults patch:', formatDbError(error));
          }
        });
    } else if (verified.name.startsWith('ضيف ') || verified.name.startsWith('عميل #')) {
      await admin
        .from('clients')
        .update({ name })
        .eq('id', verified.id)
        .then(({ error }) => {
          if (error) console.warn('[convertLeadToClient] name restore:', formatDbError(error));
        });
    }

    await admin
      .from('leads')
      .update({ client_id: verified.id })
      .eq('id', id)
      .then(({ error }) => {
        if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
          console.warn('[convertLeadToClient] client_id link:', formatDbError(error));
        }
      });

    const { error: statusError } = await admin
      .from('leads')
      .update({ status: 'converted' })
      .eq('id', id);

    if (statusError) {
      console.error('[convertLeadToClient] status update failed:', formatDbError(statusError));

      if (/converted|check constraint|status/i.test(statusError.message ?? '')) {
        const fallback = await admin.from('leads').update({ status: 'postponed' }).eq('id', id);
        if (fallback.error) {
          throw new Error(
            `تم إنشاء/ربط العميل (#${verified.id}) لكن تعذر تحديث حالة الطلب: ${formatDbError(statusError)}`,
          );
        }
      } else {
        throw new Error(
          `تم إنشاء/ربط العميل (#${verified.id}) لكن تعذر تحديث حالة الطلب: ${formatDbError(statusError)}`,
        );
      }
    }

    revalidateClientPaths(verified.id);

    return {
      ok: true,
      clientId: verified.id,
      reusedExisting,
      message: reusedExisting
        ? `تم ربط الطلب بملف عميل موجود (#${verified.id}) — ${verified.name}`
        : `تم نقل العميل إلى قاعدة البيانات بنجاح! (#${verified.id})`,
    };
  } catch (err) {
    console.error('[convertLeadToClient]', err);
    const raw = err instanceof Error ? err.message : 'تعذر نقل العميل إلى قاعدة البيانات.';
    if (/unique_phone_wa|duplicate key|23505/i.test(raw)) {
      const phone =
        pickLeadPhone(leadRow ?? {}) ||
        String(snapshot?.phone_wa ?? '').trim();
      if (phone) {
        const reclaimed = await findClientIdByPhoneAdmin(admin, phone);
        if (reclaimed) {
          const verified = await verifyClientRowExists(admin, reclaimed);
          if (verified) {
            await admin
              .from('leads')
              .update({ client_id: verified.id, status: 'converted' })
              .eq('id', id)
              .then(() => undefined);
            revalidateClientPaths(verified.id);
            return {
              ok: true,
              clientId: verified.id,
              reusedExisting: true,
              message: `تم ربط الطلب بملف عميل موجود (#${verified.id}) — ${verified.name}`,
            };
          }
        }
      }
    }
    return { ok: false, error: raw };
  }
}
