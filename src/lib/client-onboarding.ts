import {
  clientDnaSupabasePatch,
  formatInterestsForDnaColumn,
} from '@/lib/client-dna-columns';
import { CLIENT_DNA_ACTIVITY_OPTIONS, CLIENT_DNA_INTEREST_SUGGESTIONS, parseTravelDnaForm } from '@/lib/clientsTravelDna';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import { normalizeLeadStatus, type LeadStatus } from '@/lib/lead-status';
import { supabase } from '@/lib/supabase';

export const ONBOARDING_INTEREST_OPTIONS = [...CLIENT_DNA_INTEREST_SUGGESTIONS] as const;

export type OnboardingInterest = (typeof ONBOARDING_INTEREST_OPTIONS)[number];

export type OnboardingTravelDna = {
  flight_seat: string;
  food_preference: string;
  hotel_type: string;
  favorite_drink: string;
};

export const ONBOARDING_HOTEL_TYPE_OPTIONS = [
  { value: 'Ultra-Luxury', label: 'Ultra-Luxury · فائق الفخامة' },
  { value: 'Boutique/Design', label: 'Boutique/Design · بوتيك وتصميم' },
  { value: 'شقق فاخرة', label: 'شقق فاخرة' },
  { value: 'هادئة', label: '🌿 هادئة' },
  { value: 'قريبة من السنتر', label: '📍 قريبة من السنتر' },
  { value: 'مودرن', label: '🏙️ مودرن' },
] as const;

export type OnboardingProfilePayload = {
  birth_date: string;
  anniversary_date: string;
  passport_expiry: string;
  dna_activity_level: string;
  dna_special_requests: string;
  travelDna: OnboardingTravelDna;
  interests: string[];
};

export type OnboardingProfileRow = {
  client_id: string | number;
  display_name: string;
  onboarding_completed: boolean;
  birth_date: string | null;
  anniversary_date: string | null;
  passport_expiry: string | null;
  dna_activity_level: string | null;
  flight_seat: string | null;
  food_allergies: string | null;
  favorite_drink: string | null;
  hotel_preference: string | null;
  dna_interests: string | null;
  dna_special_requests: string | null;
  travel_dna: Record<string, unknown>;
  dietary: string | null;
  interests: string[];
};

/** حالة الطلب المرتبط — من leads.status (SSOT) */
export type WelcomeDnaLeadStatus = LeadStatus | string;

export type WelcomeDnaPageData = {
  profile: OnboardingProfileRow;
  status: WelcomeDnaLeadStatus;
};

export type WelcomeDnaView = 'not_found' | 'success' | 'form';

export const WELCOME_DNA_NOT_FOUND_MESSAGE =
  'رابط التعارف غير موجود أو تأكد من صحة الرابط.';

export const WELCOME_DNA_SUCCESS_MESSAGE =
  '✅ تم استلام تفضيلاتك بنجاح، فريقنا يعمل على تصميم رحلتك ✨';

/** معرّف clients.id — رقمي أو UUID */
export type ClientDbId = string | number;

const SUPABASE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupabaseUuid(value: string): boolean {
  return SUPABASE_UUID_RE.test(String(value ?? '').trim());
}

/** هل يُمرَّر clients.id مباشرة في الرابط (رقم أو UUID)؟ */
export function isClientRecordIdKey(key: string): boolean {
  const trimmed = String(key ?? '').trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return true;
  return isSupabaseUuid(trimmed);
}

export function coerceClientDbId(raw: unknown): ClientDbId | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (isSupabaseUuid(s)) return s;
  return null;
}

/** هل يُعرض نموذج DNA أم شاشة النجاح؟ — SSOT = onboarding_completed على clients */
export function isWelcomeDnaSubmitted(data: WelcomeDnaPageData): boolean {
  if (data.profile.onboarding_completed === true) return true;

  // Legacy: only treat terminal conversion as submitted — NEVER awaiting_dna / radar_pending
  const status = normalizeLeadStatus(data.status);
  if (status === 'radar_pending' || status === 'awaiting_dna') return false;

  const raw = String(data.status ?? '').trim().toLowerCase();
  if (!raw || raw === 'new' || raw === 'new_request' || raw === 'pending_approval' || raw === 'dna_sent' || raw === 'dna_pending') {
    return false;
  }
  if (raw === 'approved' || raw === 'converted') return true;

  // Past DNA in the live pipeline → success screen if they reopen the link
  if (
    status === 'meeting' ||
    status === 'quote_stage' ||
    status === 'awaiting_payment' ||
    status === 'preparing_itinerary' ||
    status === 'delivered'
  ) {
    return true;
  }

  return false;
}

export function resolveWelcomeDnaView(data: WelcomeDnaPageData | null): WelcomeDnaView {
  if (!data) return 'not_found';
  if (isWelcomeDnaSubmitted(data)) return 'success';
  return 'form';
}

export function buildOnboardingPublicUrl(clientIdOrToken: string, origin?: string): string {
  const key = String(clientIdOrToken ?? '').trim();
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  if (/^\d+$/.test(key)) {
    return `${base}/welcome/${encodeURIComponent(key)}`;
  }
  return `${base}/welcome/vip/${encodeURIComponent(key)}`;
}

export function generateOnboardingToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptyTravelDna(): OnboardingTravelDna {
  return {
    flight_seat: '',
    food_preference: '',
    hotel_type: '',
    favorite_drink: '',
  };
}

export function onboardingTravelDnaFromProfile(row: OnboardingProfileRow | null): OnboardingTravelDna {
  const dna = parseTravelDnaForm(row?.travel_dna);
  return {
    flight_seat: row?.flight_seat?.trim() || dna.preferred_seat,
    food_preference: row?.food_allergies?.trim() || dna.food_allergies || String(row?.dietary ?? '').trim(),
    hotel_type: row?.hotel_preference?.trim() || dna.hotel_style,
    favorite_drink: row?.favorite_drink?.trim() || dna.drink_coffee,
  };
}

function parseInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

function parseInterestsFromDnaColumn(value: string | null | undefined): string[] {
  const s = String(value ?? '').trim();
  if (!s) return [];
  return s.split(/[,،|]/).map((x) => x.trim()).filter(Boolean);
}

function mapOnboardingRow(raw: Record<string, unknown>): OnboardingProfileRow {
  const dna = parseTravelDnaForm(raw.travel_dna);
  const dnaInterestsCol = raw.dna_interests != null ? String(raw.dna_interests) : '';
  const interestsFromCol = parseInterestsFromDnaColumn(dnaInterestsCol);
  const interestsJson = parseInterests(raw.interests);

  return {
    client_id: coerceClientDbId(raw.client_id) ?? Number(raw.client_id),
    display_name: String(raw.display_name ?? 'ضيفنا الكريم').trim() || 'ضيفنا الكريم',
    onboarding_completed: raw.onboarding_completed === true,
    birth_date: raw.birth_date ? String(raw.birth_date).slice(0, 10) : null,
    anniversary_date: raw.anniversary_date ? String(raw.anniversary_date).slice(0, 10) : null,
    passport_expiry: raw.passport_expiry ? String(raw.passport_expiry).slice(0, 10) : null,
    dna_activity_level: raw.dna_activity_level != null ? String(raw.dna_activity_level) : null,
    flight_seat: raw.flight_seat != null ? String(raw.flight_seat) : dna.preferred_seat || null,
    food_allergies: raw.food_allergies != null ? String(raw.food_allergies) : dna.food_allergies || null,
    favorite_drink: raw.favorite_drink != null ? String(raw.favorite_drink) : dna.drink_coffee || null,
    hotel_preference: raw.hotel_preference != null ? String(raw.hotel_preference) : dna.hotel_style || null,
    dna_interests: dnaInterestsCol || null,
    dna_special_requests:
      raw.dna_special_requests != null ? String(raw.dna_special_requests) : null,
    travel_dna: dna as unknown as Record<string, unknown>,
    dietary: raw.dietary != null ? String(raw.dietary) : null,
    interests: interestsJson.length ? interestsJson : interestsFromCol,
  };
}

export async function ensureClientOnboardingToken(
  clientId: string | number,
  existingToken?: string | null,
): Promise<string> {
  if (!supabase) throw new Error('قاعدة البيانات غير مهيأة.');
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

const ONBOARDING_CLIENT_SELECT =
  'id, name, birth_date, anniversary_date, passport_expiry, dna_activity_level, dna_special_requests, flight_seat, food_allergies, favorite_drink, hotel_preference, dna_interests, travel_dna, dietary, onboarding_completed';

const ONBOARDING_CLIENT_MINIMAL_SELECT = 'id, name, onboarding_completed';

function isMissingSchemaColumnError(message: string | undefined): boolean {
  return /column|schema cache|does not exist/i.test(message ?? '');
}

async function fetchClientRowForOnboarding(
  sb: NonNullable<typeof supabase>,
  clientId: ClientDbId,
): Promise<Record<string, unknown> | null> {
  const full = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (full.data) return full.data as Record<string, unknown>;
  if (full.error && !isMissingSchemaColumnError(full.error.message)) throw full.error;

  const wide = await sb
    .from('clients')
    .select(ONBOARDING_CLIENT_SELECT)
    .eq('id', clientId)
    .maybeSingle();
  if (wide.data) return wide.data as Record<string, unknown>;
  if (wide.error && !isMissingSchemaColumnError(wide.error.message)) throw wide.error;

  const minimal = await sb
    .from('clients')
    .select(ONBOARDING_CLIENT_MINIMAL_SELECT)
    .eq('id', clientId)
    .maybeSingle();
  if (minimal.error) throw minimal.error;
  return minimal.data ? (minimal.data as Record<string, unknown>) : null;
}

async function fetchLeadStatusForClient(
  sb: NonNullable<typeof supabase>,
  clientId: ClientDbId,
): Promise<LeadStatus> {
  const { data, error } = await sb
    .from('leads')
    .select('status')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && !isMissingSchemaColumnError(error.message)) {
    console.warn('[welcome-dna] lead status lookup:', error.message);
  }
  return normalizeLeadStatus(data?.status);
}

async function resolveClientFromWelcomeToken(
  sb: NonNullable<typeof supabase>,
  key: string,
): Promise<{ clientId: ClientDbId; leadStatus: WelcomeDnaLeadStatus | null } | null> {
  /** /welcome/{clients.id} أو /welcome/vip/{onboarding_token} */
  if (/^\d+$/.test(key)) {
    const byId = await sb.from('clients').select('id').eq('id', key).maybeSingle();
    if (byId.data?.id != null) {
      const clientId = coerceClientDbId(byId.data.id);
      if (clientId != null) {
        const leadStatus = await fetchLeadStatusForClient(sb, clientId);
        return { clientId, leadStatus };
      }
    }
    if (byId.error && !isMissingSchemaColumnError(byId.error.message)) {
      // Invalid cast / missing row — continue to other strategies
      if (!/invalid input syntax|22P02|type.*(bigint|integer|uuid)/i.test(byId.error.message ?? '')) {
        throw byId.error;
      }
    }
  } else if (isSupabaseUuid(key)) {
    // Prefer onboarding_token first: generated tokens are UUIDs and clients.id is usually bigint
    const byTokenFirst = await sb
      .from('clients')
      .select('id')
      .eq('onboarding_token', key)
      .maybeSingle();
    if (byTokenFirst.data?.id != null) {
      const clientId = coerceClientDbId(byTokenFirst.data.id);
      if (clientId != null) {
        const leadStatus = await fetchLeadStatusForClient(sb, clientId);
        return { clientId, leadStatus };
      }
    }

    const byUuidId = await sb.from('clients').select('id').eq('id', key).maybeSingle();
    if (byUuidId.data?.id != null) {
      const clientId = coerceClientDbId(byUuidId.data.id);
      if (clientId != null) {
        const leadStatus = await fetchLeadStatusForClient(sb, clientId);
        return { clientId, leadStatus };
      }
    }
    if (
      byUuidId.error &&
      !isMissingSchemaColumnError(byUuidId.error.message) &&
      !/invalid input syntax|22P02|type.*(bigint|integer)/i.test(byUuidId.error.message ?? '')
    ) {
      throw byUuidId.error;
    }
  }

  const byToken = await sb
    .from('clients')
    .select('id')
    .eq('onboarding_token', key)
    .maybeSingle();

  if (byToken.data?.id != null) {
    const clientId = coerceClientDbId(byToken.data.id);
    if (clientId != null) {
      const leadStatus = await fetchLeadStatusForClient(sb, clientId);
      return { clientId, leadStatus };
    }
  }
  if (byToken.error && !isMissingSchemaColumnError(byToken.error.message)) {
    throw byToken.error;
  }

  const rpc = await sb.rpc('get_client_onboarding_by_token', { p_token: key });
  if (!rpc.error && rpc.data) {
    const clientId = coerceClientDbId((rpc.data as { client_id?: unknown }).client_id);
    if (clientId != null) {
      const leadStatus = await fetchLeadStatusForClient(sb, clientId);
      return { clientId, leadStatus };
    }
  }
  if (rpc.error && !/function|schema cache|does not exist/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  // Lead id → resolve linked clients row by phone (SSOT remains clients)
  const byLead = await sb
    .from('leads')
    .select('id, full_name, phone_wa, status')
    .eq('id', key)
    .maybeSingle();
  if (byLead.data) {
    const phone = String((byLead.data as { phone_wa?: unknown }).phone_wa ?? '').trim();
    if (phone) {
      const byPhone = await sb
        .from('clients')
        .select('id')
        .eq('phone_wa', phone)
        .maybeSingle();
      const clientId = coerceClientDbId((byPhone.data as { id?: unknown } | null)?.id);
      if (clientId != null) {
        return {
          clientId,
          leadStatus: String((byLead.data as { status?: unknown }).status ?? 'new').trim() || 'new',
        };
      }
    }
  }
  if (byLead.error && !isMissingSchemaColumnError(byLead.error.message)) {
    // ignore lead lookup failures for DNA page
  }

  return null;
}

export async function fetchWelcomeDnaPageDataWithClient(
  sb: NonNullable<typeof supabase>,
  token: string,
): Promise<WelcomeDnaPageData | null> {
  const key = String(token ?? '').trim();
  if (!key) return null;

  const resolved = await resolveClientFromWelcomeToken(sb, key);
  if (!resolved) return null;

  const row = await fetchClientRowForOnboarding(sb, resolved.clientId);
  if (!row) return null;

  const profile = await mapClientRowToOnboardingProfile(row, sb);
  const status = resolved.leadStatus ?? (await fetchLeadStatusForClient(sb, resolved.clientId));

  return { profile, status };
}

async function mapClientRowToOnboardingProfile(
  data: Record<string, unknown>,
  sb: typeof supabase = supabase,
): Promise<OnboardingProfileRow> {
  const clientId = coerceClientDbId(data.id);
  if (clientId == null) return mapOnboardingRow({ client_id: 0, display_name: data.name, ...data, interests: [] });
  const interests = await loadOnboardingInterests(clientId, sb);
  return mapOnboardingRow({
    client_id: clientId,
    display_name: data.name,
    ...data,
    interests,
  });
}

async function loadOnboardingInterests(
  clientId: ClientDbId,
  sb: typeof supabase = supabase,
): Promise<string[]> {
  if (!sb) return [];
  const prefs = await sb
    .from('client_preferences')
    .select('interests')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!prefs.error && prefs.data) {
    return parseInterests((prefs.data as { interests?: unknown }).interests);
  }
  return [];
}

/** يحمّل ملف DNA — يعمل مع عميل المتصفح أو service_role على الخادم */
export async function fetchOnboardingProfileWithClient(
  sb: NonNullable<typeof supabase>,
  token: string,
): Promise<OnboardingProfileRow | null> {
  const data = await fetchWelcomeDnaPageDataWithClient(sb, token);
  return data?.profile ?? null;
}

/**
 * يحمّل ملف DNA عبر /welcome/{onboarding_token}.
 * @deprecated للصفحات العامة — استخدم getOnboardingProfileAction (service_role)
 */
export async function fetchOnboardingProfileByToken(token: string): Promise<OnboardingProfileRow | null> {
  if (!supabase || !token.trim()) return null;
  try {
    return await fetchOnboardingProfileWithClient(supabase, token);
  } catch {
    return null;
  }
}

function buildOnboardingDbPatch(payload: OnboardingProfilePayload): Record<string, unknown> {
  const dnaInterests = formatInterestsForDnaColumn(payload.interests);
  return {
    ...clientDnaSupabasePatch({
      flight_seat: payload.travelDna.flight_seat,
      food_allergies: payload.travelDna.food_preference,
      favorite_drink: payload.travelDna.favorite_drink,
      hotel_preference: payload.travelDna.hotel_type,
      passport_expiry: payload.passport_expiry.trim() || null,
      dna_interests: dnaInterests,
      dna_activity_level: payload.dna_activity_level.trim(),
    }),
    dna_special_requests: payload.dna_special_requests.trim() || null,
  };
}

async function advanceLeadToMeetingAfterDna(
  sb: NonNullable<typeof supabase>,
  clientId: ClientDbId,
): Promise<void> {
  try {
    // DNA submitted (+ calendar already on the form) → Kanban «اجتماع العميل»
    await updatePipelineStatus(sb, { clientId, force: true }, 'meeting');
    // Belt-and-suspenders: direct update if pipeline helper no-ops
    const { error } = await sb
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
      console.warn('[onboarding] direct leads→meeting:', error.message);
    }
  } catch (err) {
    console.warn('[onboarding] advance lead to meeting:', err);
  }
}

async function persistOnboardingByClientId(
  clientId: ClientDbId,
  payload: OnboardingProfilePayload,
  sb: NonNullable<typeof supabase> = supabase!,
): Promise<boolean> {
  const patch = {
    birth_date: payload.birth_date.trim() || null,
    anniversary_date: payload.anniversary_date.trim() || null,
    onboarding_completed: true,
    ...buildOnboardingDbPatch(payload),
  };

  const { error: updateErr } = await sb.from('clients').update(patch).eq('id', clientId);
  if (updateErr) throw updateErr;

  const prefs = await sb
    .from('client_preferences')
    .select('client_id')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!prefs.error && prefs.data) {
    await sb
      .from('client_preferences')
      .update({ interests: payload.interests })
      .eq('client_id', clientId);
  } else {
    await sb.from('client_preferences').insert({ client_id: clientId, interests: payload.interests });
  }

  await advanceLeadToMeetingAfterDna(sb, clientId);
  return true;
}

/** يحفظ ملف DNA — يعمل مع عميل المتصفح أو service_role على الخادم */
export async function submitOnboardingProfileWithClient(
  sb: NonNullable<typeof supabase>,
  token: string,
  payload: OnboardingProfilePayload,
): Promise<boolean> {
  if (!token.trim()) return false;
  const key = token.trim();

  const dnaInterests = formatInterestsForDnaColumn(payload.interests);

  const rpc = await sb.rpc('submit_client_onboarding', {
    p_token: key,
    p_birth_date: payload.birth_date.trim() || null,
    p_anniversary_date: payload.anniversary_date.trim() || null,
    p_preferred_seat: payload.travelDna.flight_seat.trim() || null,
    p_food_allergies: payload.travelDna.food_preference.trim() || null,
    p_drink_coffee: payload.travelDna.favorite_drink.trim() || null,
    p_hotel_preference: payload.travelDna.hotel_type.trim() || null,
    p_passport_expiry: payload.passport_expiry.trim() || null,
    p_dna_activity_level: payload.dna_activity_level.trim() || null,
    p_dna_interests: dnaInterests || null,
    p_interests: payload.interests,
  });

  if (!rpc.error && rpc.data === true) {
    const resolved = await resolveClientFromWelcomeToken(sb, key);
    if (resolved) {
      await advanceLeadToMeetingAfterDna(sb, resolved.clientId);
    } else {
      const { data: row } = await sb
        .from('clients')
        .select('id')
        .eq('onboarding_token', key)
        .maybeSingle();
      const clientId = row ? coerceClientDbId(row.id) : null;
      if (clientId != null) await advanceLeadToMeetingAfterDna(sb, clientId);
    }
    return true;
  }

  if (rpc.error && !/function|schema cache|does not exist/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const resolved = await resolveClientFromWelcomeToken(sb, key);
  if (resolved) {
    return persistOnboardingByClientId(resolved.clientId, payload, sb);
  }

  const { data: row, error: fetchErr } = await sb
    .from('clients')
    .select('id')
    .eq('onboarding_token', key)
    .maybeSingle();

  if (fetchErr || !row) return false;
  const clientId = coerceClientDbId(row.id);
  if (clientId == null) return false;
  return persistOnboardingByClientId(clientId, payload, sb);
}

export async function submitOnboardingProfile(
  token: string,
  payload: OnboardingProfilePayload,
): Promise<boolean> {
  if (!supabase || !token.trim()) return false;
  try {
    return await submitOnboardingProfileWithClient(supabase, token, payload);
  } catch {
    return false;
  }
}

export function onboardingFormFromProfile(row: OnboardingProfileRow | null): OnboardingProfilePayload {
  return {
    birth_date: row?.birth_date ?? '',
    anniversary_date: row?.anniversary_date ?? '',
    passport_expiry: row?.passport_expiry ?? '',
    dna_activity_level: row?.dna_activity_level ?? '',
    dna_special_requests: row?.dna_special_requests ?? '',
    travelDna: onboardingTravelDnaFromProfile(row),
    interests: row?.interests ?? [],
  };
}

export function emptyOnboardingForm(): OnboardingProfilePayload {
  return {
    birth_date: '',
    anniversary_date: '',
    passport_expiry: '',
    dna_activity_level: '',
    dna_special_requests: '',
    travelDna: emptyTravelDna(),
    interests: [],
  };
}

export { CLIENT_DNA_ACTIVITY_OPTIONS };