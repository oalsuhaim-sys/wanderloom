import {
  clientDnaSupabasePatch,
  formatInterestsForDnaColumn,
} from '@/lib/client-dna-columns';
import { CLIENT_DNA_ACTIVITY_OPTIONS, CLIENT_DNA_INTEREST_SUGGESTIONS } from '@/lib/clientsTravelDna';
import { parseTravelDnaForm } from '@/lib/clientsTravelDna';
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
  travelDna: OnboardingTravelDna;
  interests: string[];
};

export type OnboardingProfileRow = {
  client_id: number;
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
  travel_dna: Record<string, unknown>;
  dietary: string | null;
  interests: string[];
};

export function buildOnboardingPublicUrl(token: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/onboarding/${token}`;
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
    client_id: Number(raw.client_id),
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
  'id, name, birth_date, anniversary_date, passport_expiry, dna_activity_level, flight_seat, food_allergies, favorite_drink, hotel_preference, dna_interests, travel_dna, dietary, onboarding_completed';

export async function fetchOnboardingProfileByToken(token: string): Promise<OnboardingProfileRow | null> {
  if (!supabase || !token.trim()) return null;

  const rpc = await supabase.rpc('get_client_onboarding_by_token', { p_token: token.trim() });
  if (!rpc.error && rpc.data) {
    return mapOnboardingRow(rpc.data as Record<string, unknown>);
  }

  if (rpc.error && !/function|schema cache|does not exist/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const { data, error } = await supabase
    .from('clients')
    .select(ONBOARDING_CLIENT_SELECT)
    .eq('onboarding_token', token.trim())
    .maybeSingle();

  if (error || !data) return null;

  const clientId = data.id;
  let interests: string[] = [];
  const prefs = await supabase.from('client_preferences').select('interests').eq('client_id', clientId).maybeSingle();
  if (!prefs.error && prefs.data) {
    interests = parseInterests((prefs.data as { interests?: unknown }).interests);
  }

  return mapOnboardingRow({
    client_id: clientId,
    display_name: data.name,
    ...data,
    interests,
  } as Record<string, unknown>);
}

function buildOnboardingDbPatch(payload: OnboardingProfilePayload): Record<string, unknown> {
  const dnaInterests = formatInterestsForDnaColumn(payload.interests);
  return clientDnaSupabasePatch({
    flight_seat: payload.travelDna.flight_seat,
    food_allergies: payload.travelDna.food_preference,
    favorite_drink: payload.travelDna.favorite_drink,
    hotel_preference: payload.travelDna.hotel_type,
    passport_expiry: payload.passport_expiry.trim() || null,
    dna_interests: dnaInterests,
    dna_activity_level: payload.dna_activity_level.trim(),
  });
}

export async function submitOnboardingProfile(
  token: string,
  payload: OnboardingProfilePayload,
): Promise<boolean> {
  if (!supabase || !token.trim()) return false;

  const dnaInterests = formatInterestsForDnaColumn(payload.interests);

  const rpc = await supabase.rpc('submit_client_onboarding', {
    p_token: token.trim(),
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
    return true;
  }

  if (rpc.error && !/function|schema cache|does not exist/i.test(rpc.error.message ?? '')) {
    throw rpc.error;
  }

  const { data: row, error: fetchErr } = await supabase
    .from('clients')
    .select('id')
    .eq('onboarding_token', token.trim())
    .maybeSingle();

  if (fetchErr || !row) return false;

  const patch = {
    birth_date: payload.birth_date.trim() || null,
    anniversary_date: payload.anniversary_date.trim() || null,
    onboarding_completed: true,
    ...buildOnboardingDbPatch(payload),
  };

  const { error: updateErr } = await supabase.from('clients').update(patch).eq('id', row.id);

  if (updateErr) throw updateErr;

  const clientId = row.id;
  const prefs = await supabase.from('client_preferences').select('client_id').eq('client_id', clientId).maybeSingle();
  if (!prefs.error && prefs.data) {
    await supabase.from('client_preferences').update({ interests: payload.interests }).eq('client_id', clientId);
  } else {
    await supabase.from('client_preferences').insert({ client_id: clientId, interests: payload.interests });
  }

  return true;
}

export function onboardingFormFromProfile(row: OnboardingProfileRow | null): OnboardingProfilePayload {
  return {
    birth_date: row?.birth_date ?? '',
    anniversary_date: row?.anniversary_date ?? '',
    passport_expiry: row?.passport_expiry ?? '',
    dna_activity_level: row?.dna_activity_level ?? '',
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
    travelDna: emptyTravelDna(),
    interests: [],
  };
}

export { CLIENT_DNA_ACTIVITY_OPTIONS };