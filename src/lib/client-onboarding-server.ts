import 'server-only';

import {
  coerceClientDbId,
  fetchWelcomeDnaPageDataWithClient,
  generateOnboardingToken,
  isClientRecordIdKey,
  isSupabaseUuid,
  submitOnboardingProfileWithClient,
  type ClientDbId,
  type OnboardingProfilePayload,
  type OnboardingProfileRow,
  type WelcomeDnaPageData,
} from '@/lib/client-onboarding';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** يضمن onboarding_token لعميل — service_role (للبوابة و /welcome/client/{id}) */
export async function ensureOnboardingTokenAdmin(clientId: ClientDbId): Promise<string> {
  const id = coerceClientDbId(clientId);
  if (id == null) {
    throw new Error('معرّف العميل غير صالح.');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('onboarding_token')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  const existing = String(data?.onboarding_token ?? '').trim();
  if (existing) return existing;

  const token = generateOnboardingToken();
  const { error: updateErr } = await admin
    .from('clients')
    .update({ onboarding_token: token })
    .eq('id', id);

  if (updateErr) {
    if (/column|schema cache|does not exist/i.test(updateErr.message ?? '')) {
      throw new Error('نفّذ supabase/sql/clients_onboarding.sql في Supabase أولاً.');
    }
    throw updateErr;
  }

  return token;
}

/** يجلب صف clients — بالـ id (UUID/رقم) أو onboarding_token */
export async function fetchClientByOnboardingTokenAdmin(
  identifier: string,
): Promise<Record<string, unknown> | null> {
  const key = String(identifier ?? '').trim();
  if (!key) return null;

  const admin = createSupabaseAdminClient();

  if (isClientRecordIdKey(key)) {
    const byId = await admin.from('clients').select('*').eq('id', key).maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return byId.data as Record<string, unknown>;
  }

  const { data, error } = await admin
    .from('clients')
    .select('*')
    .eq('onboarding_token', key)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as Record<string, unknown>) : null;
}

/** جلب بيانات صفحة DNA العامة — service_role + onboarding_token */
export async function fetchWelcomeDnaPageDataAdmin(
  token: string,
): Promise<WelcomeDnaPageData | null> {
  const key = String(token ?? '').trim();
  if (!key) return null;
  const admin = createSupabaseAdminClient();
  return fetchWelcomeDnaPageDataWithClient(admin, key);
}

/** جلب بيانات DNA عبر معرّف العميل — eq('id', clientId) على جدول clients فقط */
export async function fetchWelcomeDnaPageDataByClientIdAdmin(
  clientId: string,
): Promise<(WelcomeDnaPageData & { onboardingToken: string }) | null> {
  const id = String(clientId ?? '').trim();
  if (!id || (!/^\d+$/.test(id) && !isSupabaseUuid(id))) return null;

  const admin = createSupabaseAdminClient();

  // Try exact string match, then numeric when id is digits (PostgREST bigint)
  let clientRow: { id: unknown } | null = null;
  const primary = await admin.from('clients').select('id').eq('id', id).maybeSingle();
  if (primary.error && !/invalid input syntax|22P02/i.test(primary.error.message ?? '')) {
    throw primary.error;
  }
  clientRow = (primary.data as { id: unknown } | null) ?? null;

  if (!clientRow && /^\d+$/.test(id)) {
    const asNum = Number(id);
    if (Number.isFinite(asNum)) {
      const secondary = await admin.from('clients').select('id').eq('id', asNum).maybeSingle();
      if (secondary.error && !/invalid input syntax|22P02/i.test(secondary.error.message ?? '')) {
        throw secondary.error;
      }
      clientRow = (secondary.data as { id: unknown } | null) ?? null;
    }
  }

  if (!clientRow) return null;

  const dbId = coerceClientDbId(clientRow.id);
  if (dbId == null) return null;

  const pageData = await fetchWelcomeDnaPageDataWithClient(admin, String(dbId));
  if (!pageData) return null;

  const onboardingToken = await ensureOnboardingTokenAdmin(dbId);
  return { ...pageData, onboardingToken };
}

/** @deprecated استخدم fetchWelcomeDnaPageDataAdmin */
export async function fetchOnboardingProfileAdmin(
  token: string,
): Promise<OnboardingProfileRow | null> {
  const data = await fetchWelcomeDnaPageDataAdmin(token);
  return data?.profile ?? null;
}

/** حفظ ملف DNA من الصفحة العامة — service_role يتجاوز RLS */
export async function submitOnboardingProfileAdmin(
  token: string,
  payload: OnboardingProfilePayload,
): Promise<boolean> {
  const key = String(token ?? '').trim();
  if (!key) return false;
  const admin = createSupabaseAdminClient();
  return submitOnboardingProfileWithClient(admin, key, payload);
}

/**
 * بعد نجاح DNA: انقل الطلب إلى meeting (عمود اجتماع العميل).
 * يُستدعى صراحة من Server Action لضمان عدم تفويت التحديث.
 * @returns leadId of the linked lead when found (for Cal.com booking page).
 */
export async function ensureLeadMeetingAfterDnaAdmin(
  tokenOrClientId: string,
): Promise<{ leadId: string | null; clientId: string | number | null }> {
  const key = String(tokenOrClientId ?? '').trim();
  if (!key) return { leadId: null, clientId: null };

  const admin = createSupabaseAdminClient();
  let clientId: string | number | null = null;

  if (/^\d+$/.test(key) || isSupabaseUuid(key)) {
    clientId = coerceClientDbId(key);
  }

  if (clientId == null) {
    const { data } = await admin
      .from('clients')
      .select('id')
      .eq('onboarding_token', key)
      .maybeSingle();
    clientId = data ? coerceClientDbId(data.id) : null;
  }

  if (clientId == null && isClientRecordIdKey(key)) {
    const page = await fetchWelcomeDnaPageDataWithClient(admin, key);
    clientId = page?.profile?.client_id != null ? coerceClientDbId(page.profile.client_id) : null;
  }

  if (clientId == null) {
    console.warn('[ensureLeadMeetingAfterDnaAdmin] could not resolve client for', key);
    return { leadId: null, clientId: null };
  }

  await updatePipelineStatus(admin, { clientId, force: true }, 'meeting').catch((err) => {
    console.warn('[ensureLeadMeetingAfterDnaAdmin] pipeline:', err);
  });

  const { error } = await admin
    .from('leads')
    .update({ status: 'meeting' })
    .eq('client_id', clientId)
    .in('status', [
      'radar_pending',
      'new',
      'pending_approval',
      'awaiting_dna',
      'dna_sent',
      'dna_pending',
      'meeting',
    ]);

  if (error && !/column|schema cache|does not exist|check/i.test(error.message ?? '')) {
    console.warn('[ensureLeadMeetingAfterDnaAdmin] leads update:', error.message);
  }

  // Resolve lead id for interview calendar binding (prefer active meeting-stage row)
  let { data: leadRows } = await admin
    .from('leads')
    .select('id, status, created_at, phone_wa, client_id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10);

  // VIP individuals often lack client_id on the lead — fall back to phone match
  if (!leadRows?.length) {
    const { data: clientPhone } = await admin
      .from('clients')
      .select('phone_wa, phone_number')
      .eq('id', clientId)
      .maybeSingle();
    const phone = String(
      (clientPhone as { phone_wa?: string; phone_number?: string } | null)?.phone_wa ??
        (clientPhone as { phone_wa?: string; phone_number?: string } | null)?.phone_number ??
        '',
    ).trim();
    if (phone) {
      const byPhone = await admin
        .from('leads')
        .select('id, status, created_at, phone_wa, client_id')
        .eq('phone_wa', phone)
        .order('created_at', { ascending: false })
        .limit(10);
      leadRows = byPhone.data;
      // Backfill client_id on the matched lead so future updates stick
      const top = byPhone.data?.[0];
      if (top?.id != null && (top as { client_id?: unknown }).client_id == null) {
        await admin
          .from('leads')
          .update({ client_id: clientId })
          .eq('id', top.id)
          .then(({ error: linkErr }) => {
            if (linkErr) console.warn('[ensureLeadMeetingAfterDnaAdmin] link client_id:', linkErr.message);
          });
      }
    }
  }

  const rows = (leadRows ?? []) as Array<{ id?: unknown; status?: unknown }>;
  const meetingRow =
    rows.find((r) => {
      const s = String(r.status ?? '').trim();
      return s === 'meeting' || s === 'interview_scheduled' || s === 'awaiting_dna';
    }) ?? rows[0];

  const leadId = meetingRow?.id != null ? String(meetingRow.id).trim() : null;
  return { leadId: leadId || null, clientId };
}
