import type { SupabaseClient } from '@supabase/supabase-js';

import { generateOnboardingToken } from '@/lib/client-onboarding';
import { buildClientInsertPayload } from '@/lib/clientsTravelDna';
import { siteOrigin } from '@/lib/bank-checkout';
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions';
import type { CrmLeadRow } from '@/lib/crm-leads';

/** نوع الرحلة لصيغة رسالة واتساب فقط — الرابط دائماً /welcome/{clients.id} */
export type DnaInviteTripType = 'private' | 'group';

export const DNA_INVITE_TRIP_TYPE_OPTIONS: Array<{
  id: DnaInviteTripType;
  label: string;
}> = [
  { id: 'private', label: 'رحلة خاصة — Private' },
  { id: 'group', label: 'رحلة جماعية — Group' },
];

/** رابط نموذج DNA الموحّد — /welcome/{clients.id} (SSOT) */
export function buildClientDnaWelcomeUrlByClientId(clientId: number | string, origin?: string): string {
  const id = String(clientId ?? '').trim();
  if (!id || (!/^\d+$/.test(id) && !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new Error('معرّف العميل غير صالح لبناء رابط DNA.');
  }
  const base = (origin ?? siteOrigin()).replace(/\/$/, '');
  // /welcome/{id} → middleware redirects numeric ids to /welcome/client/{id}
  return `${base}/welcome/${encodeURIComponent(id)}`;
}

/**
 * @deprecated Prefer buildClientDnaWelcomeUrlByClientId — token URLs break when
 * onboarding_token is missing or UUID is mistaken for clients.id.
 * Kept for legacy links already sent to customers.
 */
export function buildClientDnaWelcomeUrl(onboardingToken: string, origin?: string): string {
  const token = String(onboardingToken ?? '').trim();
  if (!token) {
    throw new Error('onboarding_token مطلوب لبناء رابط DNA.');
  }
  const base = (origin ?? siteOrigin()).replace(/\/$/, '');
  return `${base}/welcome/vip/${encodeURIComponent(token)}`;
}

export const WEBSITE_INTAKE_SALES_STAGE = 'طلب موقع — بانتظار DNA';
export const QUOTE_ACCEPTED_INTAKE_SALES_STAGE = 'عرض مقبول — بانتظار DNA';
export const WEBSITE_LEAD_SOURCE = 'website_trip_log';

/** رابط Cal.com الرسمي لجلسة قراءة الأمنيات (30 دقيقة) */
export const DEFAULT_INTAKE_BOOKING_URL = 'https://cal.com/omar-alsuhaim-jv2uy2/30min';

/** متغير البيئة الاختياري لتجاوز رابط التقويم */
export const INTAKE_BOOKING_URL_ENV = 'NEXT_PUBLIC_INTAKE_BOOKING_URL';

export type ClientIntakeAutomationResult = {
  clientId: number;
  onboardingToken: string;
  dnaUrl: string;
  bookingUrl: string;
  whatsAppUrl: string;
  whatsAppMessage: string;
  emailSubject: string;
  emailBody: string;
  createdNewClient: boolean;
};

export type ClientIntakeSnapshot = {
  clientId: number;
  onboardingToken: string;
  dnaUrl: string;
  bookingUrl: string;
  onboardingCompleted: boolean;
  intakeAutomatedAt: string | null;
  dnaLinkSentAt: string | null;
  whatsAppMessage: string;
  whatsAppUrl: string;
  emailSubject: string;
  emailBody: string;
};

export type CrmLeadWithIntake = CrmLeadRow & {
  client_id?: number | null;
  intake?: ClientIntakeSnapshot | null;
};

type ClientIntakeRow = {
  id: number;
  name: string | null;
  phone_wa: string | null;
  onboarding_token: string | null;
  onboarding_completed: boolean | null;
  intake_automated_at: string | null;
  dna_link_sent_at: string | null;
};

const CLIENT_INTAKE_SELECT =
  'id, name, phone_wa, onboarding_token, onboarding_completed, intake_automated_at, dna_link_sent_at';

/** يُرجع رابط التقويم — env override ثم الرابط الرسمي المضمّن */
export function resolveIntakeBookingUrl(override?: string | null): string {
  const custom = String(override ?? '').trim();
  if (custom) return normalizeBookingUrl(custom);

  const fromEnv = process.env[INTAKE_BOOKING_URL_ENV]?.trim();
  if (fromEnv) return normalizeBookingUrl(fromEnv);

  return DEFAULT_INTAKE_BOOKING_URL;
}

function normalizeBookingUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_INTAKE_BOOKING_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isIntakeBookingUrlConfigured(override?: string | null): boolean {
  const resolved = resolveIntakeBookingUrl(override);
  return /^https?:\/\//i.test(resolved);
}

/** رسالة واتساب حسب نوع الرحلة — الرابط نفسه في الحالتين */
export function buildDnaInviteWhatsAppMessage(
  tripType: DnaInviteTripType,
  dnaUrl: string,
): string {
  const link = dnaUrl.trim();
  if (tripType === 'group') {
    return [
      'أهلاً بك في Wanderloom ✨',
      'لسعادتنا بانضمامك لرحلتنا الجماعية القادمة وتنسيق التجربة بتناغم دقيق، نرجو منك إكمال ملف الـ DNA السياحي الخاص بك عبر الرابط أدناه.',
      "فور انتهائك، سيظهر لك التقويم لتحديد موعد جلسة 'مواءمة التطلعات' القصيرة معنا، لنتأكد بشفافية أن إيقاع هذه الرحلة يناسب كل ما تطمح له 🗺️:",
      link,
    ].join('\n');
  }

  return [
    'أهلاً بك في Wanderloom ✨',
    'للبدء بتصميم تفاصيل رحلتك الاستثنائية الخاصة، نرجو منك إكمال ملف الـ DNA السياحي الخاص بك عبر الرابط أدناه.',
    'فور انتهائك، سيظهر لك التقويم لتحديد موعد اجتماع قصير معنا، وبناءً على هذا الاجتماع سنقوم بتجهيز عرض السعر النهائي لرحلتك الخاصة ✈️:',
    link,
  ].join('\n');
}

/** @deprecated استخدم buildDnaInviteWhatsAppMessage مع tripType */
export function buildLuxuryOnboardingWhatsAppMessage(
  _clientName: string,
  dnaUrl: string,
  _bookingUrl?: string,
  tripType: DnaInviteTripType = 'private',
): string {
  return buildDnaInviteWhatsAppMessage(tripType, dnaUrl);
}

/** رابط واتساب جاهز لإرسال دعوة DNA للعميل */
export function buildClientDnaWhatsAppUrl(
  phone: string,
  dnaUrl: string,
  _clientName?: string,
  tripType: DnaInviteTripType = 'private',
): string {
  const message = buildDnaInviteWhatsAppMessage(tripType, dnaUrl);
  return whatsAppHrefWithText(phone, message);
}

export function buildLuxuryOnboardingEmailPayload(
  clientName: string,
  dnaUrl: string,
  bookingUrl: string,
  tripType: DnaInviteTripType = 'private',
): { subject: string; body: string } {
  const subject = `Wanderloom · بطاقة DNA وجلسة الأمنيات — ${clientName.trim() || 'ضيفنا الكريم'}`;
  return {
    subject,
    body: buildDnaInviteWhatsAppMessage(tripType, dnaUrl),
  };
}

/** يبني رسالة + رابط واتساب — الرابط دائماً /welcome/{clients.id} */
export function buildDnaInviteWhatsAppPayload(
  phone: string,
  clientId: number | string,
  tripType: DnaInviteTripType,
  origin?: string,
): { dnaUrl: string; whatsAppMessage: string; whatsAppUrl: string } {
  const dnaUrl = buildClientDnaWelcomeUrlByClientId(clientId, origin);
  const whatsAppMessage = buildDnaInviteWhatsAppMessage(tripType, dnaUrl);
  return {
    dnaUrl,
    whatsAppMessage,
    whatsAppUrl: whatsAppHrefWithText(phone, whatsAppMessage),
  };
}

export function whatsAppHrefWithText(phone: string, text: string): string {
  const message = String(text ?? '').trim();
  const encoded = encodeURIComponent(message);
  const digits = formatWhatsAppPhone(phone).replace(/\D/g, '');

  let normalizedDigits = digits;
  if (normalizedDigits.startsWith('05')) {
    normalizedDigits = `966${normalizedDigits.slice(1)}`;
  } else if (normalizedDigits.startsWith('5') && normalizedDigits.length === 9) {
    normalizedDigits = `966${normalizedDigits}`;
  } else if (normalizedDigits.startsWith('00')) {
    normalizedDigits = normalizedDigits.slice(2);
  }

  if (normalizedDigits.length >= 8) {
    return `https://api.whatsapp.com/send?phone=${normalizedDigits}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

/** تطبيع رقم الجوال لصيغة موحّدة (966…) لتفادي تكرار العملاء */
export function canonicalizePhoneWa(phoneRaw: string): string {
  let digits = String(phoneRaw ?? '').replace(/\D/g, '');
  if (!digits) return String(phoneRaw ?? '').trim();
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('05')) digits = `966${digits.slice(1)}`;
  else if (digits.startsWith('5') && digits.length === 9) digits = `966${digits}`;
  return digits;
}

/** Reject synthetic / UUID-as-phone garbage from earlier auto-heal bugs */
export function isGarbagePhonePlaceholder(phoneRaw: string): boolean {
  const s = String(phoneRaw ?? '').trim().toLowerCase();
  if (!s) return true;
  if (
    s.startsWith('lead-') ||
    s.startsWith('pending-') ||
    s.startsWith('unknown-') ||
    s.startsWith('orphan-') ||
    s.startsWith('e2e-')
  ) {
    return true;
  }
  // UUID dumped into phone column
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  return false;
}

/** Real phone required before any clients insert */
export function isUsableClientPhone(phoneRaw: string): boolean {
  if (isGarbagePhonePlaceholder(phoneRaw)) return false;
  const digits = canonicalizePhoneWa(phoneRaw).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/** Real person name — never invent «عميل» stubs */
export function isUsableClientName(nameRaw: string): boolean {
  const name = String(nameRaw ?? '').trim();
  if (name.length < 2) return false;
  if (name === 'عميل' || name === 'ضيفنا الكريم' || name.toLowerCase() === 'client') {
    return false;
  }
  return true;
}

export function assertUsableLeadClientFields(input: {
  name?: string | null;
  phone?: string | null;
}): { name: string; phone: string } {
  const name = String(input.name ?? '').trim();
  const phoneRaw = String(input.phone ?? '').trim();
  if (!isUsableClientName(name)) {
    throw new Error('اسم العميل ناقص أو غير صالح — لا يمكن إنشاء ملف بدون اسم حقيقي.');
  }
  if (!isUsableClientPhone(phoneRaw)) {
    throw new Error(
      'بيانات العميل ناقصة أو غير صالحة. تأكد من وجود رقم الجوال (لا يُسمح بأرقام وهمية مثل lead-…).',
    );
  }
  const phone = canonicalizePhoneWa(phoneRaw) || phoneRaw;
  return { name, phone };
}

function phoneLookupCandidates(phoneRaw: string): string[] {
  const phone = phoneRaw.trim();
  if (!phone) return [];
  const spaced = formatWhatsAppPhone(phone);
  const digits = phone.replace(/\D/g, '');
  const canonical = canonicalizePhoneWa(phone);
  const local05 =
    canonical.startsWith('966') && canonical.length >= 12
      ? `0${canonical.slice(3)}`
      : '';
  const localWithoutZero =
    canonical.startsWith('966') && canonical.length >= 12 ? canonical.slice(3) : '';
  return [
    ...new Set(
      [
        phone,
        spaced,
        digits,
        canonical,
        local05,
        localWithoutZero,
        `+${canonical}`,
        canonical ? `00${canonical}` : '',
      ].filter(Boolean),
    ),
  ];
}

/** Exported for Radar DNA check-then-link + admin ensure paths */
export function buildPhoneLookupCandidates(phoneRaw: string): string[] {
  return phoneLookupCandidates(phoneRaw);
}

export function buildIntakeSnapshotFromClient(
  client: ClientIntakeRow,
  leadName: string,
  origin?: string,
  bookingUrl?: string,
  phone?: string,
): ClientIntakeSnapshot | null {
  if (!client.id) return null;

  const token = String(client.onboarding_token ?? '').trim();
  const base = siteOrigin(origin);
  const dnaUrl = buildClientDnaWelcomeUrlByClientId(client.id, base);
  const resolvedBookingUrl = resolveIntakeBookingUrl(bookingUrl);
  const displayName = leadName.trim() || String(client.name ?? '').trim() || 'ضيفنا الكريم';
  const whatsAppMessage = buildLuxuryOnboardingWhatsAppMessage(displayName, dnaUrl, resolvedBookingUrl);
  const email = buildLuxuryOnboardingEmailPayload(displayName, dnaUrl, resolvedBookingUrl);
  const phoneRaw = String(phone ?? client.phone_wa ?? '').trim();

  return {
    clientId: Number(client.id),
    onboardingToken: token,
    dnaUrl,
    bookingUrl: resolvedBookingUrl,
    onboardingCompleted: client.onboarding_completed === true,
    intakeAutomatedAt: client.intake_automated_at ?? null,
    dnaLinkSentAt: client.dna_link_sent_at ?? null,
    whatsAppMessage,
    whatsAppUrl: phoneRaw ? whatsAppHrefWithText(phoneRaw, whatsAppMessage) : '',
    emailSubject: email.subject,
    emailBody: email.body,
  };
}

async function findClientByPhone(
  supabase: SupabaseClient,
  phoneRaw: string,
): Promise<ClientIntakeRow | null> {
  if (!isUsableClientPhone(phoneRaw)) return null;
  const phone = phoneRaw.trim();
  if (!phone) return null;

  const candidates = phoneLookupCandidates(phone);
  for (const value of candidates) {
    const byWa = await supabase
      .from('clients')
      .select(CLIENT_INTAKE_SELECT)
      .eq('phone_wa', value)
      .maybeSingle();
    if (!byWa.error && byWa.data) return byWa.data as ClientIntakeRow;

    // Lean fallback when optional columns are missing from schema
    if (byWa.error && /column|schema cache|does not exist|could not find/i.test(byWa.error.message ?? '')) {
      const lean = await supabase.from('clients').select('id, name, phone_wa').eq('phone_wa', value).maybeSingle();
      if (!lean.error && lean.data?.id != null) {
        return {
          ...(lean.data as ClientIntakeRow),
          onboarding_token: null,
          onboarding_completed: false,
          intake_automated_at: null,
          dna_link_sent_at: null,
        };
      }
    }
  }

  // Fallback: match by last 9 digits on phone_wa only (no `phone` column)
  const last9 = canonicalizePhoneWa(phone).slice(-9);
  if (last9.length === 9) {
    const fuzzy = await supabase
      .from('clients')
      .select(CLIENT_INTAKE_SELECT)
      .ilike('phone_wa', `%${last9}`)
      .limit(5);
    const fuzzyRows = !fuzzy.error
      ? (fuzzy.data as ClientIntakeRow[] | null)
      : (
          await supabase
            .from('clients')
            .select('id, name, phone_wa')
            .ilike('phone_wa', `%${last9}`)
            .limit(5)
        ).data?.map((row) => ({
          ...(row as ClientIntakeRow),
          onboarding_token: null,
          onboarding_completed: false,
          intake_automated_at: null,
          dna_link_sent_at: null,
        }));

    if (fuzzyRows?.length) {
      const exact = fuzzyRows.find((row) => {
        const a = canonicalizePhoneWa(String(row.phone_wa ?? ''));
        const b = canonicalizePhoneWa(phone);
        return a.slice(-9) === b.slice(-9);
      });
      if (exact) return exact;
    }
  }

  return null;
}

async function fetchClientIntakeById(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientIntakeRow | null> {
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_INTAKE_SELECT)
    .eq('id', clientId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ClientIntakeRow;
}

async function ensureOnboardingTokenOnClient(
  supabase: SupabaseClient,
  clientId: number,
  existingToken?: string | null,
): Promise<string> {
  const current = String(existingToken ?? '').trim();
  if (current) return current;

  const token = generateOnboardingToken();
  const { error } = await supabase.from('clients').update({ onboarding_token: token }).eq('id', clientId);
  if (error) {
    if (/column|schema cache|does not exist/i.test(error.message ?? '')) {
      throw new Error('نفّذ supabase/sql/clients_onboarding.sql في Supabase أولاً.');
    }
    throw error;
  }
  return token;
}

async function linkLeadToClient(
  supabase: SupabaseClient,
  leadId: string,
  clientId: number,
): Promise<void> {
  const { error } = await supabase.from('leads').update({ client_id: clientId }).eq('id', leadId);
  if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
    console.warn('[client-intake] lead client_id link:', error.message);
  }
}

async function markClientIntakeAutomated(
  supabase: SupabaseClient,
  clientId: number,
  salesStage: string = WEBSITE_INTAKE_SALES_STAGE,
): Promise<void> {
  const patch: Record<string, unknown> = {
    sales_stage: salesStage,
    intake_automated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('clients').update(patch).eq('id', clientId);
  if (error) {
    const minimal = await supabase
      .from('clients')
      .update({ sales_stage: salesStage })
      .eq('id', clientId);
    if (minimal.error) {
      console.warn('[client-intake] intake mark:', minimal.error.message);
    }
  }
}

async function createClientFromLeadIntake(
  supabase: SupabaseClient,
  lead: Pick<CrmLeadRow, 'full_name' | 'phone_wa' | 'email' | 'referral_code'>,
): Promise<{ clientId: number; token: string; reusedExisting: boolean }> {
  const { name, phone } = assertUsableLeadClientFields({
    name: lead.full_name,
    phone: lead.phone_wa,
  });
  if (!phone) {
    throw new Error('لا يوجد رقم جوال صالح لهذا الطلب.');
  }

  function formatWriteError(error: unknown): string {
    if (!error) return 'insert failed';
    if (typeof error === 'object') {
      const e = error as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [
        e.message?.trim(),
        e.details?.trim(),
        e.hint?.trim(),
        e.code ? `code=${e.code}` : '',
      ].filter(Boolean);
      if (parts.length) return parts.join(' | ');
    }
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return String(error);
  }

  // Deduplicate before insert (race-safe) — CHECK then INSERT for unique_phone_wa
  const existing = await findClientByPhone(supabase, phone);
  if (existing?.id) {
    const token = await ensureOnboardingTokenOnClient(
      supabase,
      existing.id,
      existing.onboarding_token,
    );
    return { clientId: Number(existing.id), token, reusedExisting: true };
  }

  const token = generateOnboardingToken();

  const payload = buildClientInsertPayload({
    name,
    phone_wa: phone,
    email: lead.email?.trim() || '',
    birth_date: '',
    flight_seat: '',
    food_allergies: '',
    favorite_drink: '',
    hotel_preference: '',
    secret_notes: '',
    client_type: 'عميل',
    is_influencer: false,
    client_tier: 'regular',
    total_trips: 0,
    referrals_count: 0,
    lead_source: WEBSITE_LEAD_SOURCE,
    sales_stage: WEBSITE_INTAKE_SALES_STAGE,
    used_code: lead.referral_code?.trim() || undefined,
  });

  (payload as Record<string, unknown>).onboarding_token = token;
  (payload as Record<string, unknown>).onboarding_completed = false;
  // Minimal stub — avoid optional columns that vary by schema
  delete (payload as Record<string, unknown>).is_leader;
  delete (payload as Record<string, unknown>).is_influencer;
  delete (payload as Record<string, unknown>).client_tier;
  delete (payload as Record<string, unknown>).total_trips;
  delete (payload as Record<string, unknown>).referrals_count;
  delete (payload as Record<string, unknown>).birth_date;
  // clients table uses phone_wa only — never write `phone`

  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert(payload)
    .select('id')
    .single();

  if (clientError || !newClient?.id) {
    console.error('[client-intake] createClient insert:', clientError);
    const detail = formatWriteError(clientError);
    const isUnique = /duplicate|unique|23505|unique_phone_wa/i.test(detail);

    // unique_phone_wa → NEVER re-insert; reclaim existing client and continue DNA
    const reclaim = async () => {
      const raced = await findClientByPhone(supabase, phone);
      if (!raced?.id) return null;
      const ensured = await ensureOnboardingTokenOnClient(
        supabase,
        raced.id,
        raced.onboarding_token,
      );
      return {
        clientId: Number(raced.id),
        token: ensured,
        reusedExisting: true as const,
      };
    };

    const reclaimed = await reclaim();
    if (reclaimed) return reclaimed;

    // Schema variance only (missing onboarding_* columns) — skip if unique already hit
    if (!isUnique) {
      const withoutToken = { ...payload };
      delete (withoutToken as Record<string, unknown>).onboarding_token;
      delete (withoutToken as Record<string, unknown>).onboarding_completed;

      const retry = await supabase.from('clients').insert(withoutToken).select('id').single();
      if (!retry.error && retry.data?.id) {
        const ensured = await ensureOnboardingTokenOnClient(supabase, Number(retry.data.id));
        await supabase
          .from('client_preferences')
          .insert({ client_id: retry.data.id })
          .then(({ error }) => {
            if (error) console.warn('[client-intake] client_preferences:', error.message);
          });
        return {
          clientId: Number(retry.data.id),
          token: ensured,
          reusedExisting: false,
        };
      }
      console.error('[client-intake] createClient retry:', retry.error);
      const again = await reclaim();
      if (again) return again;
      throw new Error(
        `تعذر إنشاء ملف العميل تلقائياً من بيانات الطلب: ${formatWriteError(retry.error ?? clientError)}`,
      );
    }

    // Unique hit but lookup missed — brief wait + second reclaim pass
    await new Promise((r) => setTimeout(r, 80));
    const racedAgain = await reclaim();
    if (racedAgain) return racedAgain;

    throw new Error(
      `تعذر إنشاء ملف العميل تلقائياً من بيانات الطلب: ${detail}`,
    );
  }

  await supabase
    .from('client_preferences')
    .insert({ client_id: newClient.id })
    .then(({ error }) => {
      if (error) console.warn('[client-intake] client_preferences:', error.message);
    });

  return { clientId: Number(newClient.id), token, reusedExisting: false };
}

export async function runWebsiteLeadIntakeAutomation(
  supabase: SupabaseClient,
  lead: Pick<CrmLeadRow, 'id' | 'full_name' | 'phone_wa' | 'email' | 'referral_code'>,
  options?: { origin?: string; booking_url?: string },
): Promise<ClientIntakeAutomationResult> {
  const origin = siteOrigin(options?.origin);
  const bookingUrl = resolveIntakeBookingUrl(options?.booking_url);
  let createdNewClient = false;
  let clientRow = await findClientByPhone(supabase, lead.phone_wa);
  let token: string;

  if (clientRow) {
    // Smart recognition — returning customer: reuse profile, do not insert
    token = await ensureOnboardingTokenOnClient(supabase, clientRow.id, clientRow.onboarding_token);
    if (!clientRow.onboarding_token) {
      clientRow = (await fetchClientIntakeById(supabase, clientRow.id)) ?? clientRow;
    }
  } else {
    const created = await createClientFromLeadIntake(supabase, lead);
    createdNewClient = !created.reusedExisting;
    token = created.token;
    clientRow = await fetchClientIntakeById(supabase, created.clientId);
    if (!clientRow) {
      clientRow = {
        id: created.clientId,
        name: lead.full_name,
        phone_wa: lead.phone_wa,
        onboarding_token: token,
        onboarding_completed: false,
        intake_automated_at: null,
        dna_link_sent_at: null,
      };
    }
  }

  // New stubs get sales_stage; returning clients keep their pipeline state
  if (createdNewClient) {
    await markClientIntakeAutomated(supabase, clientRow.id);
  } else {
    await supabase
      .from('clients')
      .update({ intake_automated_at: new Date().toISOString() })
      .eq('id', clientRow.id)
      .then(({ error }) => {
        if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
          console.warn('[client-intake] returning intake touch:', error.message);
        }
      });
  }
  await linkLeadToClient(supabase, lead.id, clientRow.id);

  const dnaUrl = buildClientDnaWelcomeUrlByClientId(clientRow.id, origin);
  const displayName = lead.full_name.trim() || String(clientRow.name ?? '').trim();
  const whatsAppMessage = buildLuxuryOnboardingWhatsAppMessage(displayName, dnaUrl, bookingUrl);
  const email = buildLuxuryOnboardingEmailPayload(displayName, dnaUrl, bookingUrl);

  return {
    clientId: clientRow.id,
    onboardingToken: token,
    dnaUrl,
    bookingUrl,
    whatsAppUrl: whatsAppHrefWithText(lead.phone_wa, whatsAppMessage),
    whatsAppMessage,
    emailSubject: email.subject,
    emailBody: email.body,
    createdNewClient,
  };
}

export async function markDnaLinkSent(
  supabase: SupabaseClient,
  clientId: number,
): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ dna_link_sent_at: new Date().toISOString() })
    .eq('id', clientId);
  if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
    throw error;
  }
}

export async function enrichLeadsWithIntake(
  supabase: SupabaseClient,
  leads: CrmLeadRow[],
  options?: { origin?: string; booking_url?: string },
): Promise<CrmLeadWithIntake[]> {
  if (!leads.length) return [];

  const phones = [...new Set(leads.map((l) => l.phone_wa.trim()).filter(Boolean))];
  const leadClientIds = leads
    .map((l) => (l as CrmLeadWithIntake).client_id)
    .filter((id): id is number => id != null && Number.isFinite(Number(id)));

  const clientsByPhone = new Map<string, ClientIntakeRow>();
  const clientsById = new Map<number, ClientIntakeRow>();

  if (phones.length) {
    const res = await supabase.from('clients').select(CLIENT_INTAKE_SELECT).in('phone_wa', phones);
    if (!res.error && res.data) {
      for (const row of res.data as ClientIntakeRow[]) {
        if (row.phone_wa) clientsByPhone.set(row.phone_wa.trim(), row);
        clientsById.set(Number(row.id), row);
      }
    }
  }

  const missingIds = leadClientIds.filter((id) => !clientsById.has(id));
  if (missingIds.length) {
    const res = await supabase.from('clients').select(CLIENT_INTAKE_SELECT).in('id', missingIds);
    if (!res.error && res.data) {
      for (const row of res.data as ClientIntakeRow[]) {
        clientsById.set(Number(row.id), row);
        if (row.phone_wa) clientsByPhone.set(row.phone_wa.trim(), row);
      }
    }
  }

  const base = siteOrigin(options?.origin);
  const bookingUrl = resolveIntakeBookingUrl(options?.booking_url);

  return leads.map((lead) => {
    const withClientId = lead as CrmLeadWithIntake;
    const client =
      (withClientId.client_id != null ? clientsById.get(Number(withClientId.client_id)) : null) ??
      clientsByPhone.get(lead.phone_wa.trim()) ??
      null;

    if (!client) {
      return { ...lead, client_id: withClientId.client_id ?? null, intake: null };
    }

    const snapshot = buildIntakeSnapshotFromClient(client, lead.full_name, base, bookingUrl, lead.phone_wa);
    if (!snapshot) {
      return { ...lead, client_id: client.id, intake: null };
    }

    return {
      ...lead,
      client_id: client.id,
      intake: {
        ...snapshot,
        whatsAppUrl: whatsAppHrefWithText(lead.phone_wa, snapshot.whatsAppMessage),
      },
    };
  });
}

/** يُستدعى عند إنشاء عميل يدوياً من الطلب — يضمن رابط DNA دون إعادة الأتمتة الكاملة */
export async function provisionIntakeForExistingClient(
  supabase: SupabaseClient,
  clientId: number,
  lead: Pick<CrmLeadRow, 'id' | 'full_name' | 'phone_wa'>,
  options?: { origin?: string; booking_url?: string },
): Promise<ClientIntakeAutomationResult | null> {
  const client = await fetchClientIntakeById(supabase, clientId);
  if (!client) return null;

  const token = await ensureOnboardingTokenOnClient(supabase, clientId, client.onboarding_token);
  await linkLeadToClient(supabase, lead.id, clientId);

  const origin = siteOrigin(options?.origin);
  const bookingUrl = resolveIntakeBookingUrl(options?.booking_url);
  const dnaUrl = buildClientDnaWelcomeUrlByClientId(client.id, origin);
  const displayName = lead.full_name.trim() || String(client.name ?? '').trim();
  const whatsAppMessage = buildLuxuryOnboardingWhatsAppMessage(displayName, dnaUrl, bookingUrl);
  const email = buildLuxuryOnboardingEmailPayload(displayName, dnaUrl, bookingUrl);

  return {
    clientId,
    onboardingToken: token,
    dnaUrl,
    bookingUrl,
    whatsAppUrl: whatsAppHrefWithText(lead.phone_wa, whatsAppMessage),
    whatsAppMessage,
    emailSubject: email.subject,
    emailBody: email.body,
    createdNewClient: false,
  };
}

/** يُستدعى عند قبول/اعتماد عرض السعر — يجهّز رابط DNA دون إرساله تلقائياً */
export async function runQuoteAcceptedIntakeAutomation(
  supabase: SupabaseClient,
  input: {
    clientId: number | string;
    clientName: string;
    phoneWa: string;
    email?: string | null;
  },
  options?: { origin?: string; booking_url?: string },
): Promise<ClientIntakeAutomationResult | null> {
  const clientId = Number(input.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) return null;

  const phone = input.phoneWa.trim();

  let clientRow = await fetchClientIntakeById(supabase, clientId);
  if (!clientRow) return null;

  const token = await ensureOnboardingTokenOnClient(supabase, clientId, clientRow.onboarding_token);
  if (!clientRow.onboarding_token) {
    clientRow = (await fetchClientIntakeById(supabase, clientId)) ?? clientRow;
  }

  await markClientIntakeAutomated(supabase, clientId, QUOTE_ACCEPTED_INTAKE_SALES_STAGE);

  const origin = siteOrigin(options?.origin);
  const bookingUrl = resolveIntakeBookingUrl(options?.booking_url);
  const dnaUrl = buildClientDnaWelcomeUrlByClientId(clientRow.id, origin);
  const displayName =
    input.clientName.trim() || String(clientRow.name ?? '').trim() || 'ضيفنا الكريم';
  const whatsAppMessage = buildLuxuryOnboardingWhatsAppMessage(displayName, dnaUrl, bookingUrl);
  const email = buildLuxuryOnboardingEmailPayload(displayName, dnaUrl, bookingUrl);

  if (input.email?.trim()) {
    await supabase
      .from('clients')
      .update({ email: input.email.trim() })
      .eq('id', clientId)
      .then(({ error }) => {
        if (error) console.warn('[quote-intake] client email:', error.message);
      });
  }

  return {
    clientId,
    onboardingToken: token,
    dnaUrl,
    bookingUrl,
    whatsAppUrl: whatsAppHrefWithText(phone || String(clientRow.phone_wa ?? ''), whatsAppMessage),
    whatsAppMessage,
    emailSubject: email.subject,
    emailBody: email.body,
    createdNewClient: false,
  };
}
