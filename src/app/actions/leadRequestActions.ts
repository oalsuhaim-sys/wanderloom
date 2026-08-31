'use server';

import { revalidatePath } from 'next/cache';

import {
  buildClientDnaWelcomeUrlByClientId,
  buildPhoneLookupCandidates,
  canonicalizePhoneWa,
  isUsableClientPhone,
} from '@/lib/client-intake-pipeline';
import { DEFAULT_SALES_STAGE } from '@/lib/client-sales-stage';
import { siteOrigin } from '@/lib/bank-checkout';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type LeadRequestActionResult =
  | {
      ok: true;
      /** Numeric clients.id when linked; null if acceptance continued without a client row */
      clientId: number | null;
      /** Value used in DNA URL (clients.id or lead id fallback) */
      dnaKey: string;
      dnaUrl?: string;
      reusedExisting?: boolean;
      message: string;
    }
  | { ok: false; error: string };

function coerceClientId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function isUniquePhoneConflict(message: string, code?: string | null): boolean {
  if (String(code ?? '').trim() === '23505') return true;
  return /duplicate|unique|23505|unique_phone_wa|already exists/i.test(message);
}

function extractPhoneFromUniqueError(detail: string): string | null {
  const match = /Key \(phone_wa\)=\(([^)]+)\)/i.exec(detail);
  const raw = match?.[1]?.trim();
  return raw || null;
}

async function reclaimClientIdAfterPhoneConflict(
  admin: AdminClient,
  phoneRaw: string,
  errorDetail: string,
): Promise<number | null> {
  const fromError = extractPhoneFromUniqueError(errorDetail);
  const phones = [fromError, phoneRaw, canonicalizePhoneWa(phoneRaw)]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);

  for (const phone of phones) {
    const exact = await admin.from('clients').select('id').eq('phone_wa', phone).maybeSingle();
    const exactId = coerceClientId(exact.data?.id);
    if (exactId) return exactId;

    const byVariants = await findClientIdByPhoneVariants(admin, phone);
    if (byVariants) return byVariants;
  }

  // Brief wait then retry (race with concurrent insert)
  await new Promise((r) => setTimeout(r, 100));
  for (const phone of phones) {
    const again = await findClientIdByPhoneVariants(admin, phone);
    if (again) return again;
  }
  return null;
}

function pickLeadName(row: Record<string, unknown>): string {
  for (const key of ['full_name', 'name', 'client_name', 'customer_name']) {
    const v = String(row[key] ?? '').trim();
    if (v) return v;
  }
  return 'عميل جديد';
}

function pickLeadPhone(row: Record<string, unknown>): string {
  for (const key of ['phone_wa', 'phone', 'whatsapp', 'mobile', 'phone_number']) {
    const v = String(row[key] ?? '').trim();
    if (!v) continue;
    return canonicalizePhoneWa(v) || v;
  }
  return '';
}

function pickPreferredDestination(row: Record<string, unknown>): string | null {
  const dests = row.destinations;
  if (Array.isArray(dests)) {
    const joined = dests.map((d) => String(d ?? '').trim()).filter(Boolean).join(' · ');
    return joined || null;
  }
  const single = String(row.destination ?? row.preferred_destination ?? '').trim();
  return single || null;
}

function buildDnaSurveyUrl(clientKey: number | string, origin?: string): string {
  const id = String(clientKey ?? '').trim();
  const base = (origin ?? siteOrigin()).replace(/\/$/, '');
  return `${base}/dna-survey?client_id=${encodeURIComponent(id)}`;
}

async function loadLeadRow(
  admin: AdminClient,
  leadId: string,
): Promise<Record<string, unknown>> {
  const safe = await admin
    .from('leads')
    .select('id, full_name, phone_wa, email, destinations, destination, status, client_id')
    .eq('id', leadId)
    .maybeSingle();

  if (!safe.error && safe.data) return safe.data as Record<string, unknown>;

  const all = await admin.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (all.error) throw new Error(all.error.message || 'تعذر قراءة الطلب.');
  if (!all.data) throw new Error('لم يُعثر على الطلب.');
  return all.data as Record<string, unknown>;
}

async function patchClientMeta(
  admin: AdminClient,
  clientId: number,
  patch: Record<string, unknown>,
) {
  const attempts = [
    patch,
    (() => {
      const p = { ...patch };
      delete p.phone_wa;
      return p;
    })(),
    (() => {
      const p = { ...patch };
      delete p.phone_wa;
      delete p.dna_survey_url;
      delete p.dna_url;
      return p;
    })(),
    { name: patch.name, email: patch.email ?? null },
  ].filter((p) => Object.keys(p).length > 0);

  for (const attempt of attempts) {
    const { error } = await admin.from('clients').update(attempt).eq('id', clientId);
    if (!error) return;
    if (isUniquePhoneConflict(error.message)) continue;
    if (/column|schema cache|does not exist|check constraint/i.test(error.message)) continue;
    console.warn('[leadRequestActions] patchClientMeta soft-fail:', error.message);
    return;
  }
}

async function findClientIdByPhoneVariants(
  admin: AdminClient,
  phoneRaw: string,
): Promise<number | null> {
  if (!phoneRaw || !isUsableClientPhone(phoneRaw)) return null;

  const candidates = buildPhoneLookupCandidates(phoneRaw);
  for (const value of candidates) {
    const byWa = await admin.from('clients').select('id').eq('phone_wa', value).maybeSingle();
    const id = coerceClientId(byWa.data?.id);
    if (id) return id;

    const byPhone = await admin.from('clients').select('id').eq('phone', value).maybeSingle();
    if (!byPhone.error) {
      const phoneId = coerceClientId(byPhone.data?.id);
      if (phoneId) return phoneId;
    }

    const byNumber = await admin.from('clients').select('id').eq('phone_number', value).maybeSingle();
    if (!byNumber.error) {
      const numId = coerceClientId(byNumber.data?.id);
      if (numId) return numId;
    }
  }

  const last9 = canonicalizePhoneWa(phoneRaw).replace(/\D/g, '').slice(-9);
  if (last9.length === 9) {
    const fuzzy = await admin
      .from('clients')
      .select('id, phone_wa')
      .ilike('phone_wa', `%${last9}`)
      .limit(8);
    if (!fuzzy.error && fuzzy.data?.length) {
      const canonical = canonicalizePhoneWa(phoneRaw);
      for (const row of fuzzy.data) {
        const rowDigits = canonicalizePhoneWa(String((row as { phone_wa?: unknown }).phone_wa ?? ''));
        if (rowDigits.slice(-9) === canonical.slice(-9)) {
          const id = coerceClientId((row as { id?: unknown }).id);
          if (id) return id;
        }
      }
    }
  }

  return null;
}

async function findClientIdByExactName(
  admin: AdminClient,
  nameRaw: string,
): Promise<number | null> {
  const name = String(nameRaw ?? '').trim();
  if (!name || name === 'عميل جديد' || name === 'عميل') return null;

  const exact = await admin.from('clients').select('id, phone_wa, name').eq('name', name).limit(5);
  if (exact.error || !exact.data?.length) {
    const ilike = await admin
      .from('clients')
      .select('id, phone_wa, name')
      .ilike('name', name)
      .limit(5);
    if (ilike.error || !ilike.data?.length) return null;
    const withPhone = ilike.data.find((r) => String((r as { phone_wa?: unknown }).phone_wa ?? '').trim());
    return coerceClientId((withPhone ?? ilike.data[0])?.id);
  }

  const withPhone = exact.data.find((r) => String((r as { phone_wa?: unknown }).phone_wa ?? '').trim());
  return coerceClientId((withPhone ?? exact.data[0])?.id);
}

/**
 * Soft client link — NEVER throws. Executes at most ONE insert.
 * Never inserts phoneless stub rows when a phone exists on the request.
 */
async function tryLinkClientFromRequest(
  admin: AdminClient,
  input: {
    name: string;
    phone: string;
    email: string | null;
    destination: string | null;
    engagementStatus: 'active' | 'cold';
    linkedClientId?: number | null;
  },
): Promise<{ clientId: number; reusedExisting: boolean } | null> {
  const { name, phone, email, destination, engagementStatus, linkedClientId } = input;
  const phoneVal = phone.trim();
  const nameVal = name.trim() || 'عميل جديد';

  try {
    let targetClientId: number | null = null;
    let reusedExisting = false;

    // Step A: Search by phone (all format variants)
    if (phoneVal) {
      targetClientId = await findClientIdByPhoneVariants(admin, phoneVal);
      if (targetClientId) reusedExisting = true;
    }

    // Step B: Name fallback if phone missed
    if (!targetClientId && nameVal) {
      targetClientId = await findClientIdByExactName(admin, nameVal);
      if (targetClientId) reusedExisting = true;
    }

    // Step C: Linked lead.client_id
    if (!targetClientId && linkedClientId) {
      const { data: linkedRow } = await admin
        .from('clients')
        .select('id')
        .eq('id', linkedClientId)
        .maybeSingle();
      targetClientId = coerceClientId(linkedRow?.id);
      if (targetClientId) reusedExisting = true;
    }

    // Step D: UPDATE existing — never insert a second row
    if (targetClientId) {
      const updatePatch: Record<string, unknown> = {
        name: nameVal,
        email,
        target_trip: destination,
        engagement_status: engagementStatus,
        sales_stage: DEFAULT_SALES_STAGE,
        lead_source: 'interest_list',
        updated_at: new Date().toISOString(),
      };
      if (phoneVal) {
        updatePatch.phone_wa = phoneVal;
      }
      await patchClientMeta(admin, targetClientId, updatePatch);
      return { clientId: targetClientId, reusedExisting: true };
    }

    // Step E: SINGLE insert only if completely new
    // Never create empty-contact stubs: require a usable phone for insert
    if (!phoneVal || !isUsableClientPhone(phoneVal)) {
      console.warn(
        '[leadRequestActions] Client auto-link skipped insert — no usable phone (avoid empty profile)',
      );
      return null;
    }

    const insertPayloads: Record<string, unknown>[] = [
      {
        name: nameVal,
        phone_wa: phoneVal,
        email,
        target_trip: destination,
        client_type: 'عميل',
        sales_stage: DEFAULT_SALES_STAGE,
        engagement_status: engagementStatus,
        lead_source: 'interest_list',
      },
      {
        name: nameVal,
        phone_wa: phoneVal,
        email,
        target_trip: destination,
        client_type: 'عميل',
        sales_stage: DEFAULT_SALES_STAGE,
      },
      { name: nameVal, phone_wa: phoneVal, email, client_type: 'عميل' },
      { name: nameVal, phone_wa: phoneVal },
    ];

    for (const payload of insertPayloads) {
      const { data: created, error: insertError } = await admin
        .from('clients')
        .insert(payload)
        .select('id')
        .maybeSingle();

      if (!insertError && created?.id != null) {
        targetClientId = coerceClientId(created.id);
        reusedExisting = false;
        break;
      }

      // Unique phone → reclaim existing (do NOT fall through to name-only insert)
      if (insertError && isUniquePhoneConflict(insertError.message)) {
        const reclaimed = await findClientIdByPhoneVariants(admin, phoneVal);
        if (reclaimed) {
          targetClientId = reclaimed;
          reusedExisting = true;
          break;
        }
        continue;
      }

      if (
        insertError &&
        /column|schema cache|does not exist|check constraint|null value/i.test(insertError.message)
      ) {
        continue;
      }

      if (insertError) {
        console.warn('[leadRequestActions] Client auto-link insert warning:', insertError.message);
      }
    }

    if (!targetClientId) {
      console.warn('[leadRequestActions] Client auto-link warning: no client id (continuing fallback)');
      return null;
    }

    await patchClientMeta(admin, targetClientId, {
      name: nameVal,
      phone_wa: phoneVal,
      email,
      target_trip: destination,
      engagement_status: engagementStatus,
      sales_stage: DEFAULT_SALES_STAGE,
      lead_source: 'interest_list',
      updated_at: new Date().toISOString(),
    });

    return { clientId: targetClientId, reusedExisting };
  } catch (err) {
    console.warn('[leadRequestActions] Client auto-link warning (continuing fallback):', err);
    return null;
  }
}

function revalidateLeadClientPaths(clientId: number | null) {
  revalidatePath('/crm/radar');
  revalidatePath('/crm/clients');
  if (clientId) revalidatePath(`/crm/clients/${clientId}`);
  revalidatePath('/crm/pipeline');
  revalidatePath('/crm');
  revalidatePath('/crm', 'layout');
}

/**
 * REJECT: soft client link (cold), then remove lead from queue.
 * Client failure does not block rejection of the lead.
 *
 * NOTE: This is NOT "add to clients". Use `handleAddToClients` for the positive conversion path.
 */
export async function handleRejectRequest(
  leadId: string,
): Promise<LeadRequestActionResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    const leadRow = await loadLeadRow(admin, id);

    const nameVal = pickLeadName(leadRow);
    const phoneVal = pickLeadPhone(leadRow);
    const email = String(leadRow.email ?? '').trim() || null;
    const destination = pickPreferredDestination(leadRow);

    const linked = await tryLinkClientFromRequest(admin, {
      name: nameVal,
      phone: phoneVal,
      email,
      destination,
      engagementStatus: 'cold',
      linkedClientId: coerceClientId(leadRow.client_id),
    });

    if (linked) {
      await patchClientMeta(admin, linked.clientId, {
        name: nameVal,
        phone_wa: phoneVal || undefined,
        email,
        target_trip: destination,
        engagement_status: 'cold',
        sales_stage: DEFAULT_SALES_STAGE,
        secret_notes: 'مرفوض من رادار الطلبات',
        lead_source: 'interest_list',
      });
    }

    const { error: delErr } = await admin.from('leads').delete().eq('id', id);
    if (delErr) {
      const { error: updErr } = await admin
        .from('leads')
        .update({ status: 'radar_rejected' })
        .eq('id', id);
      if (updErr) throw new Error(delErr.message || updErr.message);
    }

    const clientId = linked?.clientId ?? null;
    revalidateLeadClientPaths(clientId);
    return {
      ok: true,
      clientId,
      dnaKey: String(clientId ?? id),
      reusedExisting: linked?.reusedExisting,
      message: 'تم رفض الطلب وإزالته من الطابور.',
    };
  } catch (err) {
    console.error('[handleRejectRequest]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر رفض الطلب.',
    };
  }
}

function formatSupabaseError(error: unknown): string {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const e = error as {
      message?: string;
      details?: string | null;
      hint?: string | null;
      code?: string | null;
    };
    return [e.message, e.code ? `code=${e.code}` : '', e.details, e.hint]
      .map((p) => String(p ?? '').trim())
      .filter(Boolean)
      .join(' | ');
  }
  return String(error);
}

/**
 * ADD TO CLIENTS ONLY — positive conversion.
 * Inserts/links with CORE columns only (`name`, `phone_wa`, optional `email`).
 * NEVER deletes the lead as rejection and NEVER writes «مرفوض» notes.
 */
export async function handleAddToClients(
  leadId: string,
  snapshot?: {
    full_name?: string | null;
    phone_wa?: string | null;
    email?: string | null;
    destinations?: string[] | null;
  } | null,
): Promise<LeadRequestActionResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    let leadRow: Record<string, unknown>;
    try {
      leadRow = await loadLeadRow(admin, id);
    } catch (loadErr) {
      if (!snapshot?.full_name && !snapshot?.phone_wa) throw loadErr;
      leadRow = {
        id,
        full_name: snapshot?.full_name ?? '',
        phone_wa: snapshot?.phone_wa ?? '',
        email: snapshot?.email ?? null,
        destinations: snapshot?.destinations ?? [],
      };
    }

    const nameVal =
      pickLeadName(leadRow) ||
      String(snapshot?.full_name ?? '').trim() ||
      'عميل جديد';
    const phoneVal =
      pickLeadPhone(leadRow) ||
      (snapshot?.phone_wa
        ? canonicalizePhoneWa(String(snapshot.phone_wa)) || String(snapshot.phone_wa).trim()
        : '');
    const email =
      String(leadRow.email ?? '').trim() ||
      String(snapshot?.email ?? '').trim() ||
      null;

    if (!phoneVal || !isUsableClientPhone(phoneVal)) {
      return {
        ok: false,
        error: 'لا يمكن الإضافة بدون رقم جوال صالح.',
      };
    }

    // 1) Reuse existing client by phone (never duplicate)
    let clientId = await findClientIdByPhoneVariants(admin, phoneVal);
    let reusedExisting = Boolean(clientId);

    if (!clientId) {
      const linkedId = coerceClientId(leadRow.client_id);
      if (linkedId) {
        const { data: linkedRow } = await admin
          .from('clients')
          .select('id')
          .eq('id', linkedId)
          .maybeSingle();
        clientId = coerceClientId(linkedRow?.id);
        if (clientId) reusedExisting = true;
      }
    }

    // 2) Upsert / insert CORE columns — treat 23505 as "already exists" (success path)
    const insertErrors: string[] = [];
    if (!clientId) {
      const corePayload: Record<string, unknown> = {
        name: nameVal,
        phone_wa: phoneVal,
        ...(email ? { email } : {}),
      };

      console.log('[handleAddToClients] Upsert payload:', corePayload);

      // Prefer upsert on unique phone_wa
      const upsertAttempt = await admin
        .from('clients')
        .upsert(corePayload, { onConflict: 'phone_wa' })
        .select('id')
        .maybeSingle();

      if (!upsertAttempt.error && upsertAttempt.data?.id != null) {
        clientId = coerceClientId(upsertAttempt.data.id);
        // Reached upsert only when not found earlier → treat as add/update success
        reusedExisting = false;
      } else if (upsertAttempt.error) {
        const detail = formatSupabaseError(upsertAttempt.error);
        const code = (upsertAttempt.error as { code?: string }).code ?? null;
        console.error('[handleAddToClients] Upsert error:', upsertAttempt.error);
        insertErrors.push(detail);

        if (isUniquePhoneConflict(detail, code)) {
          const reclaimed = await reclaimClientIdAfterPhoneConflict(admin, phoneVal, detail);
          if (reclaimed) {
            clientId = reclaimed;
            reusedExisting = true;
          }
        } else if (
          /onConflict|constraint|column|schema cache|does not exist|could not find/i.test(detail)
        ) {
          // Fall through to plain insert attempts
        } else {
          return { ok: false, error: `فشل الإدراج: ${detail}` };
        }
      }

      // Plain insert fallbacks if upsert unsupported / failed without reclaim
      if (!clientId) {
        const payloads: Record<string, unknown>[] = [
          { name: nameVal, phone_wa: phoneVal, ...(email ? { email } : {}) },
          { name: nameVal, phone_wa: phoneVal },
        ];

        for (const payload of payloads) {
          console.log('[handleAddToClients] Insert payload:', payload);
          const { data, error } = await admin
            .from('clients')
            .insert(payload)
            .select('id')
            .maybeSingle();

          if (error) {
            const detail = formatSupabaseError(error);
            const code = (error as { code?: string }).code ?? null;
            console.error('[handleAddToClients] Insert error:', error);
            insertErrors.push(detail);

            if (isUniquePhoneConflict(detail, code)) {
              const reclaimed = await reclaimClientIdAfterPhoneConflict(admin, phoneVal, detail);
              if (reclaimed) {
                clientId = reclaimed;
                reusedExisting = true;
                break;
              }
              // Unique but reclaim failed — still do not show raw 23505 to the operator
              insertErrors.push(
                'الرقم موجود مسبقاً لكن تعذر استرجاع المعرف — أعد المحاولة أو ابحث يدوياً في قاعدة العملاء',
              );
              break;
            }

            if (/column|schema cache|does not exist|could not find|null value/i.test(detail)) {
              continue;
            }
            return { ok: false, error: `فشل الإدراج: ${detail}` };
          }

          clientId = coerceClientId(data?.id);
          if (clientId) {
            reusedExisting = false;
            break;
          }
          insertErrors.push('insert returned no id after .select()');
        }
      }
    }

    if (!clientId) {
      const joined = insertErrors.filter(Boolean).join(' ← ');
      // If any unique conflict was seen, return a friendly non-fatal style message
      if (joined && isUniquePhoneConflict(joined)) {
        return {
          ok: false,
          error: `العميل موجود مسبقاً بهذا الرقم في قاعدة العملاء — ابحث عن الرقم: ${phoneVal}`,
        };
      }
      return {
        ok: false,
        error: `فشل إدراج العميل في جدول clients: ${joined || 'تحقق من الأعمدة والصلاحيات'}`,
      };
    }

    // Soft enrich after core insert/upsert (ignore optional-column failures)
    await patchClientMeta(admin, clientId, {
      name: nameVal,
      phone_wa: phoneVal,
      ...(email ? { email } : {}),
      engagement_status: 'active',
      sales_stage: DEFAULT_SALES_STAGE,
      lead_source: 'interest_list',
      secret_notes: null,
      updated_at: new Date().toISOString(),
    });

    await admin
      .from('leads')
      .update({ client_id: clientId })
      .eq('id', id)
      .then(({ error }) => {
        if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
          console.warn('[handleAddToClients] client_id link:', formatSupabaseError(error));
        }
      });

    const { error: statusError } = await admin
      .from('leads')
      .update({ status: 'converted' })
      .eq('id', id);

    if (statusError) {
      console.error('[handleAddToClients] status update:', formatSupabaseError(statusError));
      if (/converted|check constraint|status/i.test(statusError.message ?? '')) {
        const fallback = await admin.from('leads').update({ status: 'postponed' }).eq('id', id);
        if (fallback.error) {
          revalidateLeadClientPaths(clientId);
          return {
            ok: true,
            clientId,
            dnaKey: String(clientId),
            reusedExisting,
            message: reusedExisting
              ? `العميل (${nameVal}) موجود مسبقاً في قاعدة العملاء ✨`
              : `تمت إضافة العميل (#${clientId}) لكن تعذر تحديث حالة الطلب: ${formatSupabaseError(statusError)}`,
          };
        }
      } else {
        revalidateLeadClientPaths(clientId);
        return {
          ok: true,
          clientId,
          dnaKey: String(clientId),
          reusedExisting,
          message: reusedExisting
            ? `العميل (${nameVal}) موجود مسبقاً في قاعدة العملاء ✨`
            : `تمت إضافة العميل (#${clientId}) لكن تعذر تحديث حالة الطلب: ${formatSupabaseError(statusError)}`,
        };
      }
    }

    revalidateLeadClientPaths(clientId);
    return {
      ok: true,
      clientId,
      dnaKey: String(clientId),
      reusedExisting,
      message: reusedExisting
        ? `العميل (${nameVal}) موجود مسبقاً في قاعدة العملاء ✨`
        : 'تم إضافة / تحديث العميل في قاعدة العملاء بنجاح! ✨',
    };
  } catch (err) {
    console.error('[handleAddToClients] exception:', err);
    return {
      ok: false,
      error: `خطأ غير متوقع: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * ACCEPT: soft client link — at most ONE clients row; never phoneless stubs.
 * DNA URL uses clients.id when available, otherwise the lead id.
 */
export async function handleAcceptRequest(
  leadId: string,
  options?: { origin?: string | null },
): Promise<LeadRequestActionResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    const leadRow = await loadLeadRow(admin, id);

    const nameVal = pickLeadName(leadRow) || 'عميل جديد';
    const phoneVal = pickLeadPhone(leadRow);
    const email = String(leadRow.email ?? '').trim() || null;
    const destination = pickPreferredDestination(leadRow);

    // Soft client link — failures only warn; acceptance continues
    const linked = await tryLinkClientFromRequest(admin, {
      name: nameVal,
      phone: phoneVal,
      email,
      destination,
      engagementStatus: 'active',
      linkedClientId: coerceClientId(leadRow.client_id),
    });

    const targetClientId = linked?.clientId ?? null;
    // Fallback for DNA: client id OR lead id (request id)
    const finalIdForDna = String(targetClientId ?? id);

    const dnaUrl = buildDnaSurveyUrl(finalIdForDna, options?.origin ?? undefined);
    const welcomeUrl =
      targetClientId != null
        ? buildClientDnaWelcomeUrlByClientId(targetClientId, options?.origin ?? undefined)
        : `${(options?.origin ?? siteOrigin()).replace(/\/$/, '')}/welcome/${encodeURIComponent(id)}`;

    if (targetClientId != null) {
      await patchClientMeta(admin, targetClientId, {
        name: nameVal,
        phone_wa: phoneVal || undefined,
        email,
        target_trip: destination,
        engagement_status: 'active',
        sales_stage: DEFAULT_SALES_STAGE,
        dna_survey_url: dnaUrl,
        dna_url: dnaUrl,
        lead_source: 'interest_list',
      });
    }

    // Acceptance SSOT: move lead forward even without a clients row
    const leadPatch: Record<string, unknown> = {
      status: 'awaiting_dna',
    };
    if (targetClientId != null) {
      leadPatch.client_id = targetClientId;
    }

    const { error: statusErr } = await admin.from('leads').update(leadPatch).eq('id', id);
    if (statusErr) {
      // Soften status constraint — still try minimal patch
      const retry = await admin.from('leads').update({ status: 'awaiting_dna' }).eq('id', id);
      if (retry.error) {
        throw new Error(statusErr.message || 'فشل تحديث حالة الطلب بعد القبول.');
      }
    }

    revalidateLeadClientPaths(targetClientId);

    const reused = Boolean(linked?.reusedExisting);
    const linkedOk = targetClientId != null;

    return {
      ok: true,
      clientId: targetClientId,
      dnaKey: finalIdForDna,
      dnaUrl: welcomeUrl || dnaUrl,
      reusedExisting: reused,
      message: linkedOk
        ? reused
          ? 'تم قبول الطلب وربطه بملف عميل موجود — رابط DNA جاهز.'
          : 'تم قبول الطلب وإنشاء ملف العميل — رابط DNA جاهز.'
        : 'تم قبول الطلب — رابط DNA جاهز (سيتم ربط ملف العميل لاحقاً إن لزم).',
    };
  } catch (err) {
    console.error('[handleAcceptRequest]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر قبول الطلب.',
    };
  }
}
