import type { SupabaseClient } from '@supabase/supabase-js';

import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import {
  clientDnaSupabasePatch,
  formatInterestsForDnaColumn,
} from '@/lib/client-dna-columns';

export type ClientId = string | number;

export type GroupRegistrationClientInput = {
  fullName: string;
  phoneWa: string;
  email?: string | null;
  birthDate?: string | null;
  tripLabel?: string | null;
  referralCode?: string | null;
  interests?: string[];
  dailyPace?: string | null;
  foodPreferences?: string[];
  specialNotes?: string | null;
};

function sanitizePhoneDigits(phoneRaw: string): string {
  return String(phoneRaw ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

function extractClientId(raw: unknown): ClientId | null {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return extractClientId(
      raw[0] && typeof raw[0] === 'object' && raw[0] !== null && 'id' in raw[0]
        ? (raw[0] as { id: unknown }).id
        : raw[0],
    );
  }
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    return extractClientId((raw as { id: unknown }).id);
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isSafeInteger(n) && n > 0 ? n : s;
    }
    return s;
  }
  return null;
}

function buildPrimaryClientUpsertPayloads(
  input: GroupRegistrationClientInput,
): Record<string, unknown>[] {
  const name = String(input.fullName ?? '').trim();
  const cleanPhone = sanitizePhoneDigits(input.phoneWa);
  const phoneWa = cleanPhone ? canonicalizePhoneWa(cleanPhone) || cleanPhone : '';
  const email = String(input.email ?? '').trim() || null;
  const birthDate = String(input.birthDate ?? '').trim().slice(0, 10) || null;
  const tripLabel = String(input.tripLabel ?? '').trim() || null;
  const referralCode =
    String(input.referralCode ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 64) || null;

  const interests =
    Array.isArray(input.interests) && input.interests.length
      ? input.interests.map((v) => String(v).trim()).filter(Boolean)
      : ['رحلة جماعية'];
  const food = Array.isArray(input.foodPreferences)
    ? input.foodPreferences.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const pace = String(input.dailyPace ?? '').trim();
  const notes = String(input.specialNotes ?? '').trim();

  const hasDna =
    interests.length > 0 || Boolean(pace) || food.length > 0 || Boolean(notes);
  const dnaPatch = hasDna
    ? buildGroupLeadClientDnaPatch({
        interests,
        daily_pace: pace || null,
        food_preferences: food,
        final_thoughts: notes || null,
      })
    : {};

  const rich: Record<string, unknown> = {
    name,
    phone_wa: phoneWa,
    email,
    client_type: 'عميل',
    intake_trip_type: 'group',
    lead_source: 'group_onboarding',
    target_trip: tripLabel,
    tags: ['group_trip_client', 'group_onboarding_registration'],
    ...dnaPatch,
  };
  if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) rich.birth_date = birthDate;
  if (referralCode) rich.used_code = referralCode;

  return [
    rich,
    { name, phone_wa: phoneWa, email, client_type: 'عميل', intake_trip_type: 'group', ...dnaPatch },
    { name, phone_wa: phoneWa, email, client_type: 'عميل', ...dnaPatch },
    { name, phone_wa: phoneWa, client_type: 'عميل', ...dnaPatch },
    { name, phone_wa: phoneWa, ...dnaPatch },
    { name, phone_wa: cleanPhone || phoneWa, client_type: 'عميل' },
    { name, phone_wa: phoneWa },
  ];
}

/**
 * SSOT write — upsert `clients` by phone_wa before any group_members / leads linkage.
 */
export async function upsertPrimaryGroupClient(
  admin: SupabaseClient,
  input: GroupRegistrationClientInput,
): Promise<{ ok: true; clientId: ClientId } | { ok: false; error: string }> {
  const name = String(input.fullName ?? '').trim();
  const cleanPhone = sanitizePhoneDigits(input.phoneWa);
  if (!name) return { ok: false, error: 'اسم العميل ناقص.' };
  if (!cleanPhone) return { ok: false, error: 'رقم الجوال غير صالح أو مفقود.' };

  const payloads = buildPrimaryClientUpsertPayloads(input);
  let lastError = '';

  for (const payload of payloads) {
    const { data, error } = await admin
      .from('clients')
      .upsert(payload, { onConflict: 'phone_wa', ignoreDuplicates: false })
      .select('id');

    if (error) {
      lastError = error.message ?? '';
      if (/column|schema cache|does not exist|check constraint|tags|null value/i.test(lastError)) {
        continue;
      }
      continue;
    }

    const clientId = extractClientId(data);
    if (!clientId) {
      return { ok: false, error: 'تعذر استخراج معرّف العميل بعد الحفظ.' };
    }

    const interests = Array.isArray(input.interests)
      ? input.interests.map((v) => String(v).trim()).filter(Boolean)
      : [];
    if (interests.length) {
      await upsertClientPreferencesInterests(admin, clientId, interests);
    }

    return { ok: true, clientId };
  }

  return {
    ok: false,
    error: lastError || 'تعذر إنشاء/تحديث ملف العميل في قاعدة العملاء.',
  };
}

export type GroupMemberLinkStatus = 'pending_interview' | 'waitlisted' | 'approved';

/**
 * Lightweight group_members pivot after clients upsert — never the DNA SSOT.
 */
export async function linkGroupMemberToTrip(
  admin: SupabaseClient,
  input: {
    clientId: ClientId;
    tripId: string;
    customerName: string;
    customerPhone: string;
    status?: GroupMemberLinkStatus;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tripIdRaw = String(input.tripId ?? '').trim();
  if (!tripIdRaw) return { ok: false, error: 'معرّف الرحلة غير صالح.' };

  const tripKey = /^\d+$/.test(tripIdRaw) ? Number(tripIdRaw) : tripIdRaw;
  const clientKey = /^\d+$/.test(String(input.clientId))
    ? Number(input.clientId)
    : input.clientId;
  const customerName = String(input.customerName ?? '').trim();
  const cleanPhone = sanitizePhoneDigits(input.customerPhone);
  const phoneWa = cleanPhone ? canonicalizePhoneWa(cleanPhone) || cleanPhone : '';
  const status = input.status ?? 'pending_interview';

  const memberPayload: Record<string, unknown> = {
    client_id: clientKey,
    group_id: tripKey,
    status,
    payment_status: 'pending',
    customer_name: customerName,
  };
  if (phoneWa) memberPayload.customer_phone = phoneWa;

  const { data: existing } = await admin
    .from('group_members')
    .select('id')
    .eq('client_id', clientKey)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const upd: Record<string, unknown> = {
      group_id: tripKey,
      status,
      customer_name: customerName,
    };
    if (phoneWa) upd.customer_phone = phoneWa;
    let { error } = await admin.from('group_members').update(upd).eq('client_id', clientKey);
    if (error && /payment_status|customer_phone|column|schema cache/i.test(error.message ?? '')) {
      const retry = await admin
        .from('group_members')
        .update({ group_id: tripKey, status })
        .eq('client_id', clientKey);
      error = retry.error;
    }
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  let { error } = await admin.from('group_members').insert(memberPayload);
  if (
    error &&
    /payment_status|customer_phone|customer_name|column|schema cache|does not exist/i.test(
      error.message ?? '',
    )
  ) {
    const retry = await admin.from('group_members').insert({
      client_id: clientKey,
      group_id: tripKey,
      status,
    });
    error = retry.error;
  }

  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message ?? '')) {
      const upd: Record<string, unknown> = { group_id: tripKey, status };
      if (customerName) upd.customer_name = customerName;
      if (phoneWa) upd.customer_phone = phoneWa;
      const retry = await admin.from('group_members').update(upd).eq('client_id', clientKey);
      if (retry.error) return { ok: false, error: retry.error.message };
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function extractLeadInterests(leadRow: Record<string, unknown>): string[] {
  return Array.isArray(leadRow.interests)
    ? (leadRow.interests as unknown[]).map((v) => String(v).trim()).filter(Boolean)
    : [];
}

export function extractLeadFoodPreferences(leadRow: Record<string, unknown>): string[] {
  return Array.isArray(leadRow.food_preferences)
    ? (leadRow.food_preferences as unknown[]).map((v) => String(v).trim()).filter(Boolean)
    : [];
}

/** Maps group lead / member DNA → clients columns used by CRM cards & profile. */
export function buildGroupLeadClientDnaPatch(
  leadRow: Record<string, unknown>,
): Record<string, unknown> {
  const interests = extractLeadInterests(leadRow);
  const food = extractLeadFoodPreferences(leadRow);
  const pace = String(leadRow.daily_pace ?? '').trim();
  const notes = String(leadRow.final_thoughts ?? leadRow.notes ?? '').trim();

  const dnaDirect = clientDnaSupabasePatch({
    dna_interests: formatInterestsForDnaColumn(interests),
    dna_activity_level: pace || undefined,
    food_allergies: food.join('، ') || undefined,
  });

  const travelDna: Record<string, unknown> = {
    interests,
    source: 'group_onboarding',
  };
  if (pace) travelDna.daily_pace = pace;
  if (food.length) travelDna.food_preferences = food;

  return {
    ...dnaDirect,
    dna_special_requests: notes || null,
    secret_notes: notes || null,
    travel_dna: travelDna,
    updated_at: new Date().toISOString(),
  };
}

export type ResolvedGroupLeadContact = {
  phoneWa: string;
  fullName: string;
  email: string | null;
  clientId: ClientId | null;
};

function coerceDbId(raw: unknown): string | number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : s;
  }
  return s;
}

/**
 * Resolve phone/name/email for DNA submit — lead row, linked client, group_members,
 * or explicit payload from Step 1 (URL / localStorage).
 */
export async function resolveGroupLeadContact(
  admin: SupabaseClient,
  leadRow: Record<string, unknown> | null,
  overrides?: {
    phone_wa?: string | null;
    full_name?: string | null;
    email?: string | null;
  },
): Promise<ResolvedGroupLeadContact> {
  const fullName =
    String(overrides?.full_name ?? leadRow?.full_name ?? leadRow?.name ?? '').trim() ||
    'مسافر';
  const email =
    String(overrides?.email ?? leadRow?.email ?? '').trim() || null;

  const phoneCandidates: string[] = [];
  const pushPhone = (raw: unknown) => {
    const clean = sanitizePhoneDigits(String(raw ?? ''));
    if (clean && !phoneCandidates.includes(clean)) phoneCandidates.push(clean);
  };

  pushPhone(overrides?.phone_wa);
  pushPhone(leadRow?.phone_wa);
  pushPhone(leadRow?.phone);
  pushPhone(leadRow?.phone_number);

  let clientId = coerceDbId(leadRow?.client_id);

  if (clientId != null) {
    const { data: client } = await admin
      .from('clients')
      .select('id, phone_wa, name, email')
      .eq('id', clientId)
      .maybeSingle();
    if (client) {
      pushPhone((client as { phone_wa?: unknown }).phone_wa);
    }
  }

  if (!phoneCandidates.length && clientId != null) {
    const { data: members } = await admin
      .from('group_members')
      .select('customer_phone, client_id')
      .eq('client_id', clientId)
      .limit(3);
    for (const row of members ?? []) {
      pushPhone((row as { customer_phone?: unknown }).customer_phone);
    }
  }

  const preferredTripId = String(leadRow?.preferred_trip_id ?? '').trim();
  if (!phoneCandidates.length && preferredTripId && fullName) {
    const tripKey = /^\d+$/.test(preferredTripId) ? Number(preferredTripId) : preferredTripId;
    const { data: members } = await admin
      .from('group_members')
      .select('customer_phone, customer_name, client_id')
      .eq('group_id', tripKey)
      .limit(50);
    for (const row of members ?? []) {
      const memberName = String((row as { customer_name?: unknown }).customer_name ?? '').trim();
      if (memberName && memberName === fullName) {
        pushPhone((row as { customer_phone?: unknown }).customer_phone);
        if (!clientId) clientId = coerceDbId((row as { client_id?: unknown }).client_id);
      }
    }
  }

  const cleanPhone = phoneCandidates[0] ?? '';
  const phoneWa = cleanPhone ? canonicalizePhoneWa(cleanPhone) || cleanPhone : '';

  if (clientId == null && phoneWa) {
    const { data: byPhone } = await admin
      .from('clients')
      .select('id')
      .eq('phone_wa', phoneWa)
      .maybeSingle();
    clientId = coerceDbId(byPhone?.id);
  }

  return { phoneWa, fullName, email, clientId };
}

export function hasClientDnaPopulated(client: Record<string, unknown>): boolean {
  const dnaInterests = String(client.dna_interests ?? '').trim();
  if (dnaInterests) return true;

  const travelDna = client.travel_dna;
  if (travelDna && typeof travelDna === 'object' && !Array.isArray(travelDna)) {
    const interests = (travelDna as Record<string, unknown>).interests;
    if (Array.isArray(interests) && interests.length > 0) return true;
    if (typeof interests === 'string' && interests.trim()) return true;
  }

  return false;
}

export async function patchClientDnaWithFallback(
  admin: SupabaseClient,
  clientId: ClientId,
  leadRow: Record<string, unknown>,
): Promise<void> {
  const dnaPatch = buildGroupLeadClientDnaPatch(leadRow);
  const { error } = await admin.from('clients').update(dnaPatch).eq('id', clientId);
  if (!error) return;

  console.warn('[group-client-dna-sync] DNA patch full:', error.message);

  const lean: Record<string, unknown> = {
    dna_interests: dnaPatch.dna_interests,
    dna_activity_level: dnaPatch.dna_activity_level,
    food_allergies: dnaPatch.food_allergies,
    dietary: dnaPatch.dietary,
  };
  if (dnaPatch.dna_special_requests) lean.dna_special_requests = dnaPatch.dna_special_requests;

  const retry = await admin.from('clients').update(lean).eq('id', clientId);
  if (retry.error) {
    console.warn('[group-client-dna-sync] DNA patch lean:', retry.error.message);
  }
}

export async function upsertClientPreferencesInterests(
  admin: SupabaseClient,
  clientId: ClientId,
  interests: string[],
): Promise<void> {
  const list = interests.map((x) => String(x).trim()).filter(Boolean);
  if (!list.length) return;

  const clientKey = /^\d+$/.test(String(clientId)) ? Number(clientId) : clientId;
  const { data: existing } = await admin
    .from('client_preferences')
    .select('id')
    .eq('client_id', clientKey)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('client_preferences')
      .update({ interests: list })
      .eq('client_id', clientKey);
    if (error) console.warn('[group-client-dna-sync] client_preferences update:', error.message);
    return;
  }

  const { error } = await admin.from('client_preferences').insert({
    client_id: clientKey,
    interests: list,
  });
  if (error && !(error.code === '23505' || /duplicate|unique/i.test(error.message ?? ''))) {
    console.warn('[group-client-dna-sync] client_preferences insert:', error.message);
  }
}
