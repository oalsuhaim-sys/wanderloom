import 'server-only';

import type { CrmLeadRow } from '@/lib/crm-leads';
import {
  assertUsableLeadClientFields,
  buildPhoneLookupCandidates,
  canonicalizePhoneWa,
  isUsableClientName,
  isUsableClientPhone,
  runWebsiteLeadIntakeAutomation,
} from '@/lib/client-intake-pipeline';
import { normalizeDirectoryPhone } from '@/lib/client-directory-from-leads';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const LEAD_SAFE_SELECT = 'id, full_name, phone_wa, email, referral_code, status, client_id';

function pickLeadName(leadRow: Record<string, unknown>): string {
  for (const key of ['full_name', 'name', 'client_name', 'customer_name']) {
    const v = String(leadRow[key] ?? '').trim();
    if (isUsableClientName(v)) return v;
  }
  return '';
}

function pickLeadPhone(leadRow: Record<string, unknown>): string {
  for (const key of ['phone_wa', 'phone', 'whatsapp', 'mobile', 'phone_number']) {
    const v = String(leadRow[key] ?? '').trim();
    if (isUsableClientPhone(v)) return canonicalizePhoneWa(v) || v;
  }
  return '';
}

function pickLeadEmail(leadRow: Record<string, unknown>): string | null {
  const v = String(leadRow.email ?? '').trim();
  return v || null;
}

function coercePositiveClientId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** ASCII + Arabic-Indic digits only (avoids format mismatch on lookup). */
function digitsOnlyPhone(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/** Pull the conflicting phone from Postgres unique-violation detail, if present. */
export function extractPhoneFromUniqueError(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
}): string | null {
  const blob = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  const m =
    blob.match(/Key\s*\(\s*phone_wa\s*\)\s*=\s*\(\s*([^)]+)\s*\)/i) ||
    blob.match(/Key\s*\(\s*phone_number\s*\)\s*=\s*\(\s*([^)]+)\s*\)/i);
  const raw = m?.[1]?.trim();
  return raw || null;
}

/**
 * Check-first lookup by phone_wa — sanitize, maybeSingle, format variants + last-9 fuzzy.
 * Critical for unique_phone_wa: never insert when a row already exists.
 */
export async function findClientIdByPhoneAdmin(
  admin: AdminClient,
  phoneRaw: string,
): Promise<number | null> {
  const sanitizedPhone = String(phoneRaw ?? '').trim();
  if (!sanitizedPhone) return null;
  // Allow reclaim even if isUsableClientPhone is strict — unique conflict proves a row exists
  const digitCheck = digitsOnlyPhone(sanitizedPhone);
  if (digitCheck.length < 8 && !isUsableClientPhone(sanitizedPhone)) return null;

  const phone = sanitizedPhone;
  const canonical = canonicalizePhoneWa(digitsOnlyPhone(phone) || phone) || phone;
  const last9 = normalizeDirectoryPhone(phone) || digitsOnlyPhone(phone).slice(-9);
  const candidates = Array.from(
    new Set(
      [
        phone,
        ...buildPhoneLookupCandidates(phone),
        ...buildPhoneLookupCandidates(canonical),
        last9 ? `0${last9}` : '',
        last9 ? `966${last9}` : '',
        last9,
      ]
        .map((v) => String(v ?? '').trim())
        .filter(Boolean),
    ),
  );

  // Exact trimmed match first (maybeSingle — no throw on miss)
  {
    const { data, error } = await admin
      .from('clients')
      .select('id')
      .eq('phone_wa', sanitizedPhone)
      .maybeSingle();
    if (error) console.error('[findClientIdByPhoneAdmin] exact phone_wa', error);
    const id = coercePositiveClientId(data?.id);
    if (id) return id;
  }

  for (const value of candidates) {
    const byWa = await admin.from('clients').select('id').eq('phone_wa', value).maybeSingle();
    if (byWa.error) console.error('[findClientIdByPhoneAdmin] phone_wa candidate', value, byWa.error);
    const id = coercePositiveClientId(byWa.data?.id);
    if (id) return id;

    const byNumber = await admin.from('clients').select('id').eq('phone_number', value).maybeSingle();
    if (
      byNumber.error &&
      !/column|schema cache|does not exist/i.test(byNumber.error.message ?? '')
    ) {
      console.error('[findClientIdByPhoneAdmin] phone_number candidate', value, byNumber.error);
    }
    const nId = coercePositiveClientId(byNumber.data?.id);
    if (nId) return nId;
  }

  if (last9.length >= 8) {
    const fuzzyWa = await admin
      .from('clients')
      .select('id, phone_wa')
      .ilike('phone_wa', `%${last9}`)
      .limit(25);
    if (fuzzyWa.error) console.error('[findClientIdByPhoneAdmin] fuzzy phone_wa', fuzzyWa.error);

    const rows: Array<{ id?: unknown; phone_wa?: unknown; phone_number?: unknown }> = [
      ...((fuzzyWa.data as Array<{ id?: unknown; phone_wa?: unknown }>) ?? []),
    ];

    const fuzzyNum = await admin
      .from('clients')
      .select('id, phone_number')
      .ilike('phone_number', `%${last9}`)
      .limit(25);
    if (
      !fuzzyNum.error &&
      fuzzyNum.data?.length
    ) {
      rows.push(...(fuzzyNum.data as Array<{ id?: unknown; phone_number?: unknown }>));
    }

    if (rows.length) {
      const wantDigits = digitsOnlyPhone(canonical || phone);
      for (const row of rows) {
        const a = normalizeDirectoryPhone(row.phone_wa ?? row.phone_number);
        const b = normalizeDirectoryPhone(canonical);
        const rowDigits =
          digitsOnlyPhone(String(row.phone_wa ?? '')) ||
          digitsOnlyPhone(String(row.phone_number ?? ''));
        if (
          a === last9 ||
          a === b ||
          a.endsWith(last9) ||
          (wantDigits.length >= 9 &&
            rowDigits.length >= 9 &&
            (rowDigits === wantDigits ||
              rowDigits.endsWith(wantDigits.slice(-9)) ||
              wantDigits.endsWith(rowDigits.slice(-9))))
        ) {
          const id = coercePositiveClientId(row.id);
          if (id) return id;
        }
      }
    }
  }

  return null;
}

/** After unique_phone_wa conflict: resolve client id from error detail + phone candidates. */
export async function reclaimClientIdAfterUniqueConflict(
  admin: AdminClient,
  attemptedPhone: string,
  insertError: { message?: string; details?: string | null; hint?: string | null },
): Promise<number | null> {
  const fromDetail = extractPhoneFromUniqueError(insertError);
  const phones = Array.from(
    new Set(
      [
        fromDetail,
        String(attemptedPhone ?? '').trim(),
        canonicalizePhoneWa(digitsOnlyPhone(attemptedPhone) || attemptedPhone),
      ]
        .filter((v): v is string => Boolean(v && String(v).trim()))
        .map((v) => String(v).trim()),
    ),
  );

  for (const phone of phones) {
    const id = await findClientIdByPhoneAdmin(admin, phone);
    if (id) return id;

    // Direct maybeSingle on the exact DB key from the error (highest signal)
    const { data } = await admin.from('clients').select('id').eq('phone_wa', phone).maybeSingle();
    const exact = coercePositiveClientId(data?.id);
    if (exact) return exact;
  }
  return null;
}

async function softLinkLeadToClient(
  admin: AdminClient,
  leadId: string,
  clientId: number,
): Promise<void> {
  const key = String(leadId ?? '').trim();
  if (!key || key.startsWith('orphan-')) return;
  const { error } = await admin.from('leads').update({ client_id: clientId }).eq('id', key);
  if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
    console.warn('[ensureLeadClient] link client_id:', error.message);
  }
}

/**
 * Self-heal: create a minimal clients stub from REAL lead name + phone only.
 * Never invent «عميل» or synthetic phones (lead-… / pending-…).
 * Surfaces exact Supabase message/details/hint/code — never a bare «insert failed».
 */
function formatClientsDbError(error: unknown, fallback = 'insert failed'): string {
  if (!error) return fallback;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) {
    const anyErr = error as Error & { details?: string; hint?: string; code?: string };
    const parts = [
      anyErr.message.trim(),
      anyErr.details?.trim(),
      anyErr.hint?.trim(),
      anyErr.code ? `code=${anyErr.code}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  }
  if (typeof error === 'object') {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [
      e.message?.trim(),
      e.details?.trim(),
      e.hint?.trim(),
      e.code ? `code=${e.code}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function isUniqueViolation(message: string): boolean {
  return /duplicate|unique|already exists|23505/i.test(message);
}

async function healCreateClientFromLead(
  admin: AdminClient,
  lead: Pick<CrmLeadRow, 'id' | 'full_name' | 'phone_wa' | 'email'>,
): Promise<{ clientId: number; reusedExisting: boolean }> {
  const { name, phone } = assertUsableLeadClientFields({
    name: lead.full_name,
    phone: lead.phone_wa,
  });
  if (!phone) {
    throw new Error('لا يوجد رقم جوال صالح لهذا الطلب.');
  }

  const email = String(lead.email ?? '').trim() || null;

  // 1) CHECK first — smart recognition / unique_phone_wa
  const existingId = await findClientIdByPhoneAdmin(admin, phone);
  if (existingId) {
    await softLinkLeadToClient(admin, lead.id, existingId);
    return { clientId: existingId, reusedExisting: true };
  }

  // 2) INSERT only if no row — progressive lean payloads for schema variance
  const attempts: Record<string, unknown>[] = [
    {
      name,
      phone_wa: phone,
      email,
      client_type: 'عميل',
      client_tier: 'regular',
      sales_stage: 'طلب انضمام جديد',
      total_trips: 0,
      lead_source: 'website_lead',
      vip_tier: 'gold',
    },
    {
      name,
      phone_wa: phone,
      email,
      client_type: 'عميل',
      sales_stage: 'بانتظار DNA',
      lead_source: 'website_lead',
    },
    { name, phone_wa: phone, email, client_type: 'عميل', sales_stage: 'طلب انضمام جديد' },
    { name, phone_wa: phone, email, client_type: 'عميل' },
    { name, phone_wa: phone, client_type: 'عميل' },
    { name, phone_wa: phone },
  ];

  const errors: string[] = [];

  for (const payload of attempts) {
    const { data, error } = await admin.from('clients').insert(payload).select('id').single();
    if (!error && data?.id != null) {
      const id = Number(data.id);
      if (Number.isFinite(id) && id > 0) {
        await softLinkLeadToClient(admin, lead.id, id);
        return { clientId: id, reusedExisting: false };
      }
    }

    const msg = formatClientsDbError(error);
    console.error('[ensureLeadClient] heal insert attempt failed:', error, payload);
    errors.push(msg);

    // 3) Race / unique_phone_wa → reclaim existing row (never surface 23505 to UI)
    if (isUniqueViolation(msg)) {
      const raced = await reclaimClientIdAfterUniqueConflict(
        admin,
        phone,
        (error ?? {}) as { message?: string; details?: string | null; hint?: string | null },
      );
      if (raced) {
        await softLinkLeadToClient(admin, lead.id, raced);
        return { clientId: raced, reusedExisting: true };
      }
      await new Promise((r) => setTimeout(r, 50));
      const racedAgain = await reclaimClientIdAfterUniqueConflict(
        admin,
        phone,
        (error ?? {}) as { message?: string; details?: string | null; hint?: string | null },
      );
      if (racedAgain) {
        await softLinkLeadToClient(admin, lead.id, racedAgain);
        return { clientId: racedAgain, reusedExisting: true };
      }
    }
  }

  const lastChance = await findClientIdByPhoneAdmin(admin, phone);
  if (lastChance) {
    await softLinkLeadToClient(admin, lead.id, lastChance);
    return { clientId: lastChance, reusedExisting: true };
  }

  const detail = errors.filter(Boolean).join(' ← ') || 'insert failed';
  throw new Error(`تعذر إنشاء ملف العميل تلقائياً من بيانات الطلب: ${detail}`);
}

export type EnsureLeadClientResult = {
  clientId: number;
  /** true = matched existing clients.phone_wa (returning customer) — no new insert */
  reusedExisting: boolean;
};

/**
 * يضمن وجود عميل في clients وربط leads.client_id عند توفر العمود.
 * Smart recognition: match phone_wa first → attach lead to existing profile (multi-trip).
 * Self-healing: إن فشلت أتمتة الـ DNA الكاملة، يُنشأ صف clients بسيط من بيانات الـ lead.
 */
export async function ensureLeadClientIntakeAdmin(
  leadId: string,
): Promise<EnsureLeadClientResult> {
  const key = String(leadId ?? '').trim();
  if (!key) throw new Error('معرّف الطلب غير صالح.');

  const admin = createSupabaseAdminClient();

  let leadRow: Record<string, unknown> | null = null;

  const safe = await admin.from('leads').select(LEAD_SAFE_SELECT).eq('id', key).maybeSingle();
  if (!safe.error && safe.data) {
    leadRow = safe.data as Record<string, unknown>;
  } else {
    const all = await admin.from('leads').select('*').eq('id', key).maybeSingle();
    if (all.error) throw new Error(all.error.message || 'تعذر قراءة الطلب.');
    if (!all.data) throw new Error('لم يُعثر على الطلب.');
    leadRow = all.data as Record<string, unknown>;
  }

  if (!leadRow) throw new Error('لم يُعثر على الطلب.');

  const lead = {
    id: String(leadRow.id ?? key),
    full_name: pickLeadName(leadRow),
    phone_wa: pickLeadPhone(leadRow),
    email: pickLeadEmail(leadRow),
    referral_code: leadRow.referral_code != null ? String(leadRow.referral_code).trim() : null,
  } satisfies Pick<CrmLeadRow, 'id' | 'full_name' | 'phone_wa' | 'email' | 'referral_code'>;

  if (!lead.phone_wa || !isUsableClientName(lead.full_name)) {
    const full = await admin.from('leads').select('*').eq('id', key).maybeSingle();
    if (!full.error && full.data) {
      const row = full.data as Record<string, unknown>;
      if (!lead.phone_wa) lead.phone_wa = pickLeadPhone(row);
      if (!isUsableClientName(lead.full_name)) lead.full_name = pickLeadName(row);
      if (!lead.email) lead.email = pickLeadEmail(row);
    }
  }

  assertUsableLeadClientFields({ name: lead.full_name, phone: lead.phone_wa });

  // Already linked via client_id
  const existingClientId = leadRow.client_id != null ? Number(leadRow.client_id) : NaN;
  if (Number.isFinite(existingClientId) && existingClientId > 0) {
    const check = await admin.from('clients').select('id').eq('id', existingClientId).maybeSingle();
    if (!check.error && check.data?.id != null) {
      return { clientId: existingClientId, reusedExisting: true };
    }
  }

  // Smart recognition: existing client by phone → attach lead (returning customer)
  const byPhone = await findClientIdByPhoneAdmin(admin, lead.phone_wa);
  if (byPhone) {
    await softLinkLeadToClient(admin, lead.id, byPhone);
    return { clientId: byPhone, reusedExisting: true };
  }

  try {
    const intake = await runWebsiteLeadIntakeAutomation(admin, {
      id: lead.id,
      full_name: lead.full_name,
      phone_wa: lead.phone_wa,
      email: lead.email,
      referral_code: lead.referral_code,
    });
    return {
      clientId: intake.clientId,
      reusedExisting: !intake.createdNewClient,
    };
  } catch (primaryErr) {
    console.warn('[ensureLeadClient] intake automation failed — self-heal:', primaryErr);
    return healCreateClientFromLead(admin, lead);
  }
}

/**
 * Self-heal from directory card fields when lead id resolve fails or is partial.
 */
export async function ensureClientFromDirectoryFieldsAdmin(input: {
  leadId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<EnsureLeadClientResult> {
  const leadId = String(input.leadId ?? '').trim();
  if (leadId) {
    try {
      return await ensureLeadClientIntakeAdmin(leadId);
    } catch (err) {
      console.warn('[ensureClientFromDirectory] lead path failed, field heal:', err);
    }
  }

  const admin = createSupabaseAdminClient();
  const email = String(input.email ?? '').trim() || null;
  const { name: safeName, phone: safePhone } = assertUsableLeadClientFields({
    name: input.name,
    phone: input.phone,
  });

  const existing = await findClientIdByPhoneAdmin(admin, safePhone);
  if (existing) {
    if (leadId) await softLinkLeadToClient(admin, leadId, existing);
    return { clientId: existing, reusedExisting: true };
  }

  return healCreateClientFromLead(admin, {
    id: leadId || '',
    full_name: safeName,
    phone_wa: safePhone,
    email,
  });
}
