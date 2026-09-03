'use server';

import { revalidatePath } from 'next/cache';

import { insertGroupTripLeadAdmin } from '@/lib/group-lead-insert';
import {
  computePaymentDeadlineForBookedSeats,
  crossesScarcityThreshold,
  fetchGroupTripCapacity,
  PAYMENT_GRACE_MS,
} from '@/lib/group-members';
import { ar } from '@/messages/ar';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseUrl, resolveSupabaseServiceRoleKey } from '@/lib/supabase/env';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';
import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { requireValidPhone } from '@/lib/phoneUtils';
import {
  extractReferralCodeFromLead,
  processReferralCommissionOnLeadApproval,
} from '@/lib/referral-rewards';
import { SALES_STAGE_PENDING_PAYMENT } from '@/lib/client-sales-stage';
import {
  parsePreferredTripIdLoose,
  resolveLeadBookedTripId,
} from '@/lib/crm-leads';
import { isInboxPendingLeadStatus } from '@/lib/lead-status';
import {
  buildGroupLeadClientDnaPatch,
  extractLeadFoodPreferences,
  extractLeadInterests,
  linkGroupMemberToTrip,
  patchClientDnaWithFallback,
  resolveGroupLeadContact,
  upsertClientPreferencesInterests,
  upsertPrimaryGroupClient,
} from '@/lib/group-client-dna-sync';

export type GroupTripLeadState =
  | {
      ok: true;
      message: string;
      leadId: string;
      clientId: string;
      placement: 'pipeline' | 'waitlisted';
    }
  | { ok: false; error: string };

export type GroupLeadDnaPayload = {
  interests: string[];
  daily_pace: string;
  food_preferences: string[];
  final_thoughts: string;
  /** Fallback from Step 1 when leads.phone_wa is empty */
  phone_wa?: string;
  full_name?: string;
  email?: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Keep DNA / preferred_trip notes; replace only prior interview lines. */
function mergeInterviewNote(existing: string | null | undefined, note: string): string {
  const cleaned = String(existing ?? '')
    .replace(/مقابلة مجدولة[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned ? `${cleaned}\n${note}` : note;
}

/** Keep group-onboarding markers when DNA notes overwrite final_thoughts. */
function preserveGroupOnboardingThoughts(
  existing: string | null | undefined,
  next: string,
): string {
  const prev = String(existing ?? '').trim();
  let out = String(next ?? '').trim();

  const joinHeader = prev.match(/طلب انضمام لرحلة جماعية[^\n]*/i)?.[0]?.trim();
  if (joinHeader && !/طلب انضمام لرحلة جماعية/i.test(out)) {
    out = out ? `${joinHeader}\n${out}` : joinHeader;
  } else if (!/رحلة جماعية|رحلة مجموعة|preferred_trip:/i.test(out)) {
    out = out
      ? `${out}\nطلب انضمام لرحلة جماعية`
      : 'طلب انضمام لرحلة جماعية';
  }

  const preferred =
    prev.match(/preferred_trip:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ??
    null;
  if (preferred && !/preferred_trip:/i.test(out)) {
    out = `${out} · ${preferred}`;
  }

  return out.trim();
}

function isLeadColumnError(message: string | undefined): boolean {
  return /column|schema cache|does not exist|could not find/i.test(message ?? '');
}

/** Progressive `leads` select — skips missing columns (e.g. client_id before migration). */
async function fetchLeadRowById(
  admin: SupabaseClient,
  leadId: string,
  selectAttempts: readonly string[],
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }
> {
  let lastError = '';
  for (const cols of selectAttempts) {
    const { data, error } = await admin.from('leads').select(cols).eq('id', leadId).maybeSingle();
    if (error) {
      lastError = error.message ?? 'select failed';
      if (isLeadColumnError(lastError)) continue;
      return { ok: false, error: lastError };
    }
    if (!data) return { ok: false, error: 'لم يتم العثور على الطلب.' };
    return { ok: true, row: data as Record<string, unknown> };
  }
  return { ok: false, error: lastError || 'لم يتم العثور على الطلب.' };
}

/** Optional link — no-op when leads.client_id column is not migrated yet. */
async function safeLinkLeadClientId(
  admin: SupabaseClient,
  leadId: string,
  clientId: string | number,
): Promise<void> {
  const key = /^\d+$/.test(String(clientId)) ? Number(clientId) : clientId;
  const { error } = await admin.from('leads').update({ client_id: key }).eq('id', leadId);
  if (error && !isLeadColumnError(error.message)) {
    console.warn('[groupOnboarding] leads.client_id link:', error.message);
  }
}

const DNA_LEAD_FETCH_SELECTS = [
  'id, full_name, phone_wa, email, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type',
  'id, full_name, phone_wa, email, destinations, interests, daily_pace, food_preferences, final_thoughts, status',
  'id, full_name, phone_wa, destinations, interests, status, final_thoughts',
  'id, full_name, phone_wa, destinations, status',
  'id, full_name, phone_wa, email, client_id, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type',
] as const;

const DNA_LEAD_SUBMIT_SELECTS = [
  'final_thoughts, preferred_trip_id, form_type, travel_style, interests, status, full_name, phone_wa, email, birth_date, destinations',
  'final_thoughts, preferred_trip_id, interests, status, full_name, phone_wa, email, destinations',
  'final_thoughts, interests, status, full_name, phone_wa, destinations, preferred_trip_id',
  'interests, status, full_name, phone_wa, destinations, final_thoughts',
  'final_thoughts, preferred_trip_id, form_type, travel_style, interests, status, full_name, phone_wa, email, birth_date, destinations, client_id',
] as const;

function leadHasBookedInterviewSlot(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const meetingDate = String(row.meeting_date ?? '').trim();
  if (meetingDate) {
    const d = new Date(meetingDate);
    if (!Number.isNaN(d.getTime())) return true;
  }
  const interviewDate = String(row.interview_date ?? '').trim().slice(0, 10);
  const interviewTime = String(row.interview_time ?? '').trim();
  if (
    interviewDate &&
    interviewTime &&
    interviewTime.toLowerCase() !== 'cal.com'
  ) {
    return true;
  }
  const thoughts = String(row.final_thoughts ?? '');
  return /مقابلة مجدولة:\s*\d{4}-\d{2}-\d{2}/i.test(thoughts);
}

/** Age in full years from yyyy-mm-dd birth date. */
function ageFromBirthDate(iso: string): number | null {
  const trimmed = String(iso ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const birth = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 1 || age > 120) return null;
  return age;
}

/**
 * Trip at capacity → clients SSOT first, then group_members.waitlisted.
 */
async function placePublicRegistrantOnWaitlist(input: {
  fullName: string;
  phoneWa: string;
  email: string | null;
  tripId: string;
  tripTitle: string;
  birthDate?: string | null;
  age?: number | null;
  referralCode?: string | null;
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const clientResult = await upsertPrimaryGroupClient(admin, {
    fullName: input.fullName,
    phoneWa: input.phoneWa,
    email: input.email,
    birthDate: input.birthDate,
    tripLabel: input.tripTitle,
    referralCode: input.referralCode,
  });
  if (!clientResult.ok) return clientResult;

  const link = await linkGroupMemberToTrip(admin, {
    clientId: clientResult.clientId,
    tripId: input.tripId,
    customerName: input.fullName,
    customerPhone: input.phoneWa,
    status: 'waitlisted',
  });
  if (!link.ok) return { ok: false, error: link.error };

  return { ok: true, clientId: String(clientResult.clientId) };
}

/**
 * Public group-trip registration — capacity-aware:
 * - Seats available → leads pipeline (awaiting_dna / meeting)
 * - Confirmed capacity full → group_members.waitlisted only (no interview)
 */
export async function submitGroupTripLead(input: {
  full_name: string;
  phone_wa: string;
  email?: string | null;
  /** Preferred: yyyy-mm-dd — age is derived when provided */
  birth_date?: string | null;
  /** Legacy home modal — used when birth_date is absent */
  age?: number;
  trip_label: string;
  preferred_trip_id?: string | null;
  /** Optional affiliate / partner referral code */
  referral_code?: string | null;
}): Promise<GroupTripLeadState> {
  try {
    const full_name = s(input.full_name);
    const phoneCheck = requireValidPhone(s(input.phone_wa));
    if (!phoneCheck.isValid) {
      return { ok: false, error: phoneCheck.error ?? ar.errors.trip.namePhone };
    }
    const phone_wa = phoneCheck.formattedPhone;
    const emailRaw = s(input.email ?? '');
    const email = emailRaw || null;
    const trip_label = s(input.trip_label);
    const preferred_trip_id = s(input.preferred_trip_id ?? '');
    const birth_date = s(input.birth_date ?? '').slice(0, 10) || null;
    const referral_code =
      s(input.referral_code ?? '')
        .toUpperCase()
        .slice(0, 64) || null;

    let age =
      birth_date != null
        ? ageFromBirthDate(birth_date)
        : Math.floor(Number(input.age));

    if (birth_date && age == null) {
      return { ok: false, error: ar.errors.groupTrip.invalidBirthDate };
    }
    if (!Number.isFinite(age as number)) {
      age = null;
    }

    if (!full_name || !phone_wa) {
      return { ok: false, error: ar.errors.trip.namePhone };
    }
    if (email && !isValidEmail(email)) {
      return { ok: false, error: ar.errors.groupTrip.invalidEmail };
    }
    if (birth_date) {
      if (!age || age < 1 || age > 120) {
        return { ok: false, error: ar.errors.groupTrip.invalidBirthDate };
      }
    } else if (!Number.isFinite(age as number) || (age as number) < 1 || (age as number) > 120) {
      return { ok: false, error: ar.errors.groupTrip.invalidAge };
    }
    if (!trip_label) {
      return { ok: false, error: ar.errors.groupTrip.missingPackage };
    }

    const ageNum = age as number;

    const serviceKeyError = assertServiceRoleKeyConfigured();
    if (serviceKeyError) return { ok: false, error: serviceKeyError };

    const admin = createSupabaseAdminClient();

    // 1. SSOT — upsert primary clients row first (name, phone_wa, email, birth_date)
    const clientResult = await upsertPrimaryGroupClient(admin, {
      fullName: full_name,
      phoneWa: phone_wa,
      email,
      birthDate: birth_date,
      tripLabel: trip_label,
      referralCode: referral_code,
    });
    if (!clientResult.ok) {
      return { ok: false, error: clientResult.error };
    }
    const clientId = String(clientResult.clientId);

    // Capacity gate when registering against a concrete trip
    if (preferred_trip_id) {
      const capacity = await fetchGroupTripCapacity(admin, preferred_trip_id);
      if (!capacity.ok) {
        console.warn('[submitGroupTripLead] capacity:', capacity.error);
      } else if (!capacity.data.isActive) {
        return { ok: false, error: 'هذه الرحلة غير مفعّلة حالياً.' };
      } else if (!capacity.data.hasConfirmedCapacity) {
        if (!capacity.data.allowWaitlist) {
          return {
            ok: false,
            error: `الرحلة «${capacity.data.titleAr}» مكتملة وقائمة الانتظار غير مفعّلة.`,
          };
        }

        const memberLink = await linkGroupMemberToTrip(admin, {
          clientId: clientResult.clientId,
          tripId: capacity.data.tripId,
          customerName: full_name,
          customerPhone: phone_wa,
          status: 'waitlisted',
        });
        if (!memberLink.ok) {
          console.error('Supabase Form Error:', memberLink.error);
          return {
            ok: false,
            error: `${ar.errors.trip.dbSaveFailed}\n${ar.errors.trip.dbSaveFailedDetail.replace('{detail}', memberLink.error)}`,
          };
        }

        revalidatePath('/');
        revalidatePath('/crm/radar');
        revalidatePath('/crm/clients');
        revalidatePath(`/crm/clients/${clientId}`);
        revalidatePath('/crm/groups');
        revalidatePath(`/crm/groups/${capacity.data.tripId}`);

        return {
          ok: true,
          leadId: '',
          clientId,
          placement: 'waitlisted',
          message: `المقاعد المؤكدة مكتملة (${capacity.data.confirmedCount}/${capacity.data.maxSeats || '∞'}) — تم إضافتك إلى قائمة انتظار «${capacity.data.titleAr}». سنتواصل معك عند توفر مقعد.`,
        };
      }

      // 2. Lightweight group_members pivot (pending interview / approval queue)
      const memberLink = await linkGroupMemberToTrip(admin, {
        clientId: clientResult.clientId,
        tripId: preferred_trip_id,
        customerName: full_name,
        customerPhone: phone_wa,
        status: 'pending_interview',
      });
      if (!memberLink.ok) {
        console.warn('[submitGroupTripLead] group_members link:', memberLink.error);
      }
    }

    // 3. Secondary — leads inbox row for DNA URL + radar (linked to clients.id)
    const leadResult = await insertGroupTripLeadAdmin({
      fullName: full_name,
      phoneWa: phone_wa,
      email: email || '',
      age: ageNum,
      birthDate: birth_date,
      tripLabel: trip_label,
      preferredTripId: preferred_trip_id || null,
      referralCode: referral_code,
    });

    if (!leadResult.ok) {
      console.error('Supabase Form Error:', leadResult.error);
      return {
        ok: false,
        error: `${ar.errors.trip.dbSaveFailed}\n${ar.errors.trip.dbSaveFailedDetail.replace('{detail}', leadResult.error)}`,
      };
    }

    await safeLinkLeadClientId(admin, leadResult.leadId, clientResult.clientId);

    revalidatePath('/');
    revalidatePath('/crm/radar');
    revalidatePath('/crm/clients');
    revalidatePath(`/crm/clients/${clientId}`);
    if (preferred_trip_id) {
      revalidatePath(`/crm/groups/${preferred_trip_id}`);
    }

    return {
      ok: true,
      leadId: leadResult.leadId,
      clientId,
      placement: 'pipeline',
      message: ar.success.groupTripRegistered,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Supabase Form Error:', message);
    return {
      ok: false,
      error: `${ar.errors.trip.dbSaveFailed}\n${ar.errors.trip.dbSaveFailedDetail.replace('{detail}', message)}`,
    };
  }
}

export type GroupRegistrationDraftPayload = {
  full_name: string;
  phone_wa: string;
  email?: string | null;
  birth_date?: string | null;
  trip_label: string;
  preferred_trip_id: string;
  referral_code?: string | null;
  interview_date?: string | null;
  interview_time?: string | null;
  media_consent?: boolean;
};

function validateGroupRegistrationDraft(
  input: GroupRegistrationDraftPayload,
): { ok: true; age: number; birth_date: string | null } | { ok: false; error: string } {
  const full_name = s(input.full_name);
  const phone_wa = s(input.phone_wa);
  const emailRaw = s(input.email ?? '');
  const email = emailRaw || null;
  const trip_label = s(input.trip_label);
  const preferred_trip_id = s(input.preferred_trip_id);
  const birth_date = s(input.birth_date ?? '').slice(0, 10) || null;

  let age =
    birth_date != null ? ageFromBirthDate(birth_date) : null;

  if (!full_name || !phone_wa) {
    return { ok: false, error: ar.errors.trip.namePhone };
  }
  if (!preferred_trip_id || !trip_label) {
    return { ok: false, error: ar.errors.groupTrip.missingPackage };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, error: ar.errors.groupTrip.invalidEmail };
  }
  if (birth_date) {
    if (!age || age < 1 || age > 120) {
      return { ok: false, error: ar.errors.groupTrip.invalidBirthDate };
    }
  } else {
    return { ok: false, error: ar.errors.groupTrip.invalidBirthDate };
  }

  return { ok: true, age, birth_date };
}

/**
 * Creates clients + leads rows only — no group_members until terms confirmation finalizes.
 */
async function registerGroupTripLeadAtConfirmation(
  input: GroupRegistrationDraftPayload,
): Promise<{ ok: true; leadId: string; clientId: ClientId } | { ok: false; error: string }> {
  const validated = validateGroupRegistrationDraft(input);
  if (!validated.ok) return validated;

  const full_name = s(input.full_name);
  const phone_wa = s(input.phone_wa);
  const email = s(input.email ?? '') || null;
  const trip_label = s(input.trip_label);
  const preferred_trip_id = s(input.preferred_trip_id);
  const birth_date = validated.birth_date;
  const referral_code =
    s(input.referral_code ?? '')
      .toUpperCase()
      .slice(0, 64) || null;

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();

  const capacity = await fetchGroupTripCapacity(admin, preferred_trip_id);
  if (capacity.ok && !capacity.data.isActive) {
    return { ok: false, error: 'هذه الرحلة غير مفعّلة حالياً.' };
  }

  const clientResult = await upsertPrimaryGroupClient(admin, {
    fullName: full_name,
    phoneWa: phone_wa,
    email,
    birthDate: birth_date,
    tripLabel: trip_label,
    referralCode: referral_code,
  });
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error };
  }

  const leadResult = await insertGroupTripLeadAdmin({
    fullName: full_name,
    phoneWa: phone_wa,
    email: email || '',
    age: validated.age,
    birthDate: birth_date,
    tripLabel: trip_label,
    preferredTripId: preferred_trip_id,
    referralCode: referral_code,
  });

  if (!leadResult.ok) {
    return { ok: false, error: leadResult.error };
  }

  await safeLinkLeadClientId(admin, leadResult.leadId, clientResult.clientId);

  return {
    ok: true,
    leadId: leadResult.leadId,
    clientId: clientResult.clientId,
  };
}

/**
 * Final group onboarding submit — ALL database writes happen here after terms acceptance.
 */
export async function confirmGroupRegistrationFromDraft(
  draft: GroupRegistrationDraftPayload,
  agreedToTerms: boolean,
): Promise<GroupDirectBookingResult> {
  if (!agreedToTerms) {
    return {
      ok: false,
      error: 'يرجى الموافقة على شروط وأحكام الرحلة الجماعية قبل المتابعة.',
    };
  }

  const reg = await registerGroupTripLeadAtConfirmation(draft);
  if (!reg.ok) return reg;

  const interviewDate = String(draft.interview_date ?? '').trim().slice(0, 10);
  const interviewTime = String(draft.interview_time ?? '').trim();
  if (interviewDate && interviewTime) {
    const saved = await saveInterviewDate(reg.leadId, interviewDate, interviewTime);
    if (!saved.ok) {
      console.warn('[confirmGroupRegistrationFromDraft] interview slot:', saved.error);
    }
  }

  const result = await confirmGroupDirectBooking(
    reg.leadId,
    true,
    draft.media_consent ?? true,
  );

  if (result.ok) {
    revalidatePath('/');
    revalidatePath('/crm/radar');
    revalidatePath('/crm/clients');
    revalidatePath(`/crm/clients/${result.clientId}`);
    if (draft.preferred_trip_id) {
      revalidatePath(`/crm/groups/${draft.preferred_trip_id}`);
    }
  }

  return result;
}

export async function fetchGroupLeadForDnaAction(
  leadId: string,
): Promise<
  | {
      ok: true;
      lead: {
        id: string;
        full_name: string;
        phone_wa: string;
        email: string;
        client_id: string;
        destinations: string[];
        interests: string[];
        daily_pace: string | null;
        food_preferences: string[];
        final_thoughts: string;
        status: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف غير صالح' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const loaded = await fetchLeadRowById(admin, id, DNA_LEAD_FETCH_SELECTS);
  if (!loaded.ok) {
    console.error('Supabase Form Error:', loaded.error);
    return { ok: false, error: loaded.error || 'تعذّر تحميل الطلب' };
  }

  const row = loaded.row;
  return {
    ok: true,
    lead: {
      id: String(row.id),
      full_name: String(row.full_name ?? ''),
      phone_wa: String(row.phone_wa ?? row.phone ?? ''),
      email: String(row.email ?? ''),
      client_id: row.client_id != null ? String(row.client_id) : '',
      destinations: Array.isArray(row.destinations)
        ? (row.destinations as unknown[]).map(String)
        : [],
      interests: Array.isArray(row.interests) ? (row.interests as unknown[]).map(String) : [],
      daily_pace: row.daily_pace != null ? String(row.daily_pace) : null,
      food_preferences: Array.isArray(row.food_preferences)
        ? (row.food_preferences as unknown[]).map(String)
        : [],
      final_thoughts: String(row.final_thoughts ?? ''),
      status: row.status != null ? String(row.status) : null,
    },
  };
}

export async function submitGroupLeadDnaAction(
  leadId: string,
  payload: GroupLeadDnaPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف غير صالح' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();

  const loaded = await fetchLeadRowById(admin, id, DNA_LEAD_SUBMIT_SELECTS);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error || 'تعذّر تحميل الطلب' };
  }

  const existingRow = loaded.row;
  const currentStatus = String(existingRow?.status ?? '').trim().toLowerCase();
  const isInboxPending =
    !currentStatus ||
    currentStatus === 'pending' ||
    currentStatus === 'radar_pending' ||
    currentStatus === 'new' ||
    currentStatus === 'new_request' ||
    currentStatus === 'pending_approval';

  const mergedThoughts = preserveGroupOnboardingThoughts(
    existingRow?.final_thoughts != null ? String(existingRow.final_thoughts) : '',
    payload.final_thoughts.trim() || '',
  );

  const interests = Array.isArray(payload.interests) ? [...payload.interests] : [];
  if (!interests.some((item) => /رحلة جماعية|رحلة مجموعة/i.test(String(item ?? '')))) {
    interests.push('رحلة جماعية');
  }

  const baseUpdate: Record<string, unknown> = {
    interests,
    daily_pace: payload.daily_pace || null,
    food_preferences: payload.food_preferences,
    final_thoughts: mergedThoughts || null,
    form_type: 'group_trip',
    travel_style: 'Group',
  };

  // Only advance to interview pipeline after admin inbox approval
  if (!isInboxPending) {
    baseUpdate.status = 'meeting';
  }

  const preferredFromExisting = String(existingRow?.preferred_trip_id ?? '').trim();
  if (preferredFromExisting) {
    baseUpdate.preferred_trip_id = preferredFromExisting;
  }

  const leadContact = existingRow;
  const destinations = Array.isArray(leadContact?.destinations)
    ? (leadContact.destinations as unknown[]).map((v) => String(v).trim()).filter(Boolean)
    : [];

  const resolvedContact = await resolveGroupLeadContact(admin, leadContact, {
    phone_wa: payload.phone_wa,
    full_name: payload.full_name,
    email: payload.email,
  });

  if (!resolvedContact.phoneWa) {
    console.error('[group-dna] phone missing for lead', id, {
      leadPhone: leadContact?.phone_wa,
      payloadPhone: payload.phone_wa,
      clientId: leadContact?.client_id,
    });
    return { ok: false, error: 'رقم الجوال غير صالح أو مفقود.' };
  }

  // Back-fill lead contact columns when Step 1 wrote clients but not leads.phone_wa
  if (!String(leadContact?.phone_wa ?? '').trim()) {
    await admin
      .from('leads')
      .update({
        phone_wa: resolvedContact.phoneWa,
        ...(resolvedContact.email ? { email: resolvedContact.email } : {}),
      } as never)
      .eq('id', id)
      .then(({ error: patchErr }) => {
        if (patchErr && !/column|schema cache|does not exist/i.test(patchErr.message ?? '')) {
          console.warn('[group-dna] leads.phone_wa backfill:', patchErr.message);
        }
      });
  }

  // 1. SSOT — write DNA directly to clients (upsert by phone_wa) BEFORE secondary lead patch
  const clientResult = await upsertPrimaryGroupClient(admin, {
    fullName: resolvedContact.fullName,
    phoneWa: resolvedContact.phoneWa,
    email: resolvedContact.email,
    birthDate:
      leadContact?.birth_date != null ? String(leadContact.birth_date).slice(0, 10) : null,
    tripLabel: destinations[0] ?? null,
    interests,
    dailyPace: payload.daily_pace || null,
    foodPreferences: payload.food_preferences,
    specialNotes: mergedThoughts || null,
  });
  if (!clientResult.ok) {
    console.error('[group-dna] clients upsert:', clientResult.error);
    return { ok: false, error: clientResult.error };
  }

  const { error } = await admin.from('leads').update(baseUpdate as never).eq('id', id);

  if (error) {
    console.error('Supabase Form Error:', error.message);
    const lean = { ...baseUpdate };
    delete lean.form_type;
    delete lean.travel_style;
    delete lean.preferred_trip_id;
    const retry = await admin.from('leads').update(lean as never).eq('id', id);
    if (retry.error) {
      const minimal = {
        interests,
        daily_pace: payload.daily_pace || null,
        food_preferences: payload.food_preferences,
        final_thoughts: mergedThoughts || null,
      };
      const last = await admin.from('leads').update(minimal as never).eq('id', id);
      if (last.error) return { ok: false, error: last.error.message };
    }
  }

  await safeLinkLeadClientId(admin, id, clientResult.clientId);

  // EVENT A — DNA submitted → Kanban meeting (only when already approved)
  if (!isInboxPending) {
    const { updatePipelineStatus } = await import('@/lib/lead-pipeline-automation');
    await updatePipelineStatus(admin, { leadId: id, force: true }, 'meeting').catch((err) =>
      console.warn('[group-dna] pipeline meeting:', err),
    );
  }

  const preferredTripId = preferredFromExisting;
  if (preferredTripId) {
    const memberLink = await linkGroupMemberToTrip(admin, {
      clientId: clientResult.clientId,
      tripId: preferredTripId,
      customerName: resolvedContact.fullName,
      customerPhone: resolvedContact.phoneWa,
      status: 'pending_interview',
    });
    if (!memberLink.ok) {
      console.warn('[group-dna] group_members link:', memberLink.error);
    }
  }

  revalidatePath('/crm/radar');
  revalidatePath('/crm/clients');
  revalidatePath(`/crm/clients/${clientResult.clientId}`);
  if (preferredTripId) {
    revalidatePath(`/crm/groups/${preferredTripId}`);
  }
  return { ok: true };
}

/**
 * Inbox gate — move pending group registration to interview queue (مواعيد المقابلات).
 */
export async function approveGroupLeadFromInbox(
  leadId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const existingLead = await admin
    .from('leads')
    .select('status, meeting_date, interview_date, interview_time, final_thoughts')
    .eq('id', id)
    .maybeSingle();

  const existingRow = (existingLead.data ?? null) as Record<string, unknown> | null;
  const nextStatus = leadHasBookedInterviewSlot(existingRow)
    ? 'interview_scheduled'
    : 'approved';

  const { data, error } = await admin
    .from('leads')
    .update({
      status: nextStatus,
      form_type: 'group_trip',
      travel_style: 'Group',
    })
    .eq('id', id)
    .select('full_name')
    .maybeSingle();

  if (error) {
    const retry = await admin.from('leads').update({ status: 'approved' }).eq('id', id);
    if (retry.error) return { ok: false, error: retry.error.message };
  }

  const name = String((data as { full_name?: string } | null)?.full_name ?? '').trim() || 'العميل';
  revalidatePath('/crm/radar');
  return {
    ok: true,
    message: `تمت الموافقة — ${name} ينتقل إلى مواعيد المقابلات القادمة`,
  };
}

export async function saveInterviewDate(
  leadId: string,
  date: string,
  time: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  const interviewDate = String(date ?? '').trim().slice(0, 10);
  const interviewTime = String(time ?? '').trim();

  if (!id || !interviewDate || !interviewTime) {
    return { ok: false, error: 'يرجى اختيار التاريخ والوقت' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const bookedNote = `مقابلة مجدولة: ${interviewDate} ${interviewTime}`;

  const { data: existing } = await admin
    .from('leads')
    .select('final_thoughts, status')
    .eq('id', id)
    .maybeSingle();

  const existingRow = (existing ?? null) as Record<string, unknown> | null;
  const inboxPending = isInboxPendingLeadStatus(existingRow?.status);
  const existingThoughts =
    existingRow?.final_thoughts != null ? String(existingRow.final_thoughts) : '';

  const meetingIso = `${interviewDate}T${toIsoTimeHint(interviewTime)}`;
  const meetingTimestamptz = (() => {
    const d = new Date(meetingIso);
    return Number.isNaN(d.getTime()) ? meetingIso : d.toISOString();
  })();

  const buildPayload = (includeStatus: boolean): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      interview_date: interviewDate,
      interview_time: interviewTime,
      meeting_date: meetingTimestamptz,
      meeting_time: interviewTime,
      scheduled_at: meetingTimestamptz,
      final_thoughts: mergeInterviewNote(existingThoughts, bookedNote),
    };
    if (includeStatus && !inboxPending) {
      payload.status = 'interview_scheduled';
    }
    return payload;
  };

  let { error } = await admin.from('leads').update(buildPayload(true)).eq('id', id);

  if (error) {
    console.error('Supabase Form Error:', error.message);
    if (/meeting_date|meeting_time|scheduled_at|column|schema cache/i.test(error.message ?? '')) {
      // Retry with canonical interview_* columns only
      const retry = await admin
        .from('leads')
        .update({
          interview_date: interviewDate,
          interview_time: interviewTime,
          ...(inboxPending ? {} : { status: 'interview_scheduled' }),
          final_thoughts: mergeInterviewNote(existingThoughts, bookedNote),
        })
        .eq('id', id);
      if (!retry.error) {
        revalidatePath('/crm/radar');
        return { ok: true };
      }
      if (/interview_date|interview_time|column|schema cache/i.test(retry.error.message ?? '')) {
        const fallback = await admin
          .from('leads')
          .update({
            ...(inboxPending ? {} : { status: 'interview_scheduled' }),
            final_thoughts: mergeInterviewNote(existingThoughts, bookedNote),
          })
          .eq('id', id);
        if (fallback.error) {
          return { ok: false, error: fallback.error.message };
        }
      } else if (/final_thoughts/i.test(retry.error.message ?? '')) {
        const withoutNotes = await admin
          .from('leads')
          .update({
            interview_date: interviewDate,
            interview_time: interviewTime,
            ...(inboxPending ? {} : { status: 'interview_scheduled' }),
          })
          .eq('id', id);
        if (withoutNotes.error) {
          return { ok: false, error: withoutNotes.error.message };
        }
      } else {
        return { ok: false, error: retry.error.message };
      }
    } else if (/interview_date|interview_time|column|schema cache/i.test(error.message ?? '')) {
      const fallback = await admin
        .from('leads')
        .update({
          ...(inboxPending ? {} : { status: 'interview_scheduled' }),
          final_thoughts: mergeInterviewNote(existingThoughts, bookedNote),
        })
        .eq('id', id);
      if (fallback.error) {
        return { ok: false, error: fallback.error.message };
      }
    } else if (/final_thoughts/i.test(error.message ?? '')) {
      const withoutNotes = await admin
        .from('leads')
        .update({
          interview_date: interviewDate,
          interview_time: interviewTime,
          ...(inboxPending ? {} : { status: 'interview_scheduled' }),
        })
        .eq('id', id);
      if (withoutNotes.error) {
        return { ok: false, error: withoutNotes.error.message };
      }
    } else {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath('/crm/radar');
  return { ok: true };
}

function toIsoTimeHint(timeLabel: string): string {
  const raw = String(timeLabel ?? '').trim();
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}:00`;
  }
  const hm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}:00`;
  return '12:00:00';
}

export type ConfirmInterviewBookedPayload = {
  interviewDate?: string;
  interviewTime?: string;
};

export type GroupLeadDecisionResult =
  | { ok: true; message: string; clientId?: string | number }
  | { ok: false; error: string };

type GroupLeadDecisionKind = 'approved' | 'marketing_archive' | 'dna_submitted' | 'registration';

/** clients.id may be integer OR uuid depending on environment. */
type ClientId = string | number;

/**
 * Bulletproof extraction from upsert/select payloads:
 * array of rows | single row object | raw id string/number.
 */
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

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }

  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (Number.isSafeInteger(n) && n > 0) return n;
      return s;
    }
    // UUID (and any other non-empty opaque id)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      return s;
    }
    return s;
  }

  return null;
}

function formatClientDbError(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}): string {
  return [error.message, error.details, error.hint, error.code ? `code=${error.code}` : '']
    .filter(Boolean)
    .join(' | ');
}

/** Digits only — converts Arabic-Indic numerals first. */
function sanitizePhoneDigits(phoneRaw: string): string {
  return String(phoneRaw ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/**
 * Admin client for the full approval transaction (clients + group_members + leads).
 * Never falls back to anon — that causes INSERT-success / SELECT-null under RLS.
 */
function createApprovalAdminClient(): SupabaseClient {
  const adminAuth = resolveSupabaseServiceRoleKey();
  if (!adminAuth) {
    throw new Error('Missing Supabase Service Role Key (SUPABASE_SERVICE_ROLE_KEY أو SUPABASE_SERVICE_KEY)');
  }
  const url =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim() || getSupabaseUrl();
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  try {
    return createSupabaseAdminClient();
  } catch {
    return createClient(url, adminAuth, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${adminAuth}`,
          apikey: adminAuth,
        },
      },
    });
  }
}

/**
 * Atomic find-or-create via Postgres UPSERT on phone_wa.
 * Avoids SELECT-miss + INSERT 23505 paradox under RLS / format mismatch.
 */
async function resolveClientForGroupApproval(
  leadRow: Record<string, unknown>,
  admin: SupabaseClient,
): Promise<
  | { ok: true; clientId: ClientId; clientName: string; reusedExisting: boolean }
  | { ok: false; error: string }
> {
  const name = String(leadRow.full_name ?? leadRow.name ?? '').trim();
  const phoneRaw = leadRow.phone_wa != null ? String(leadRow.phone_wa) : '';
  const cleanPhone = phoneRaw ? sanitizePhoneDigits(phoneRaw) : '';

  if (!name) return { ok: false, error: 'اسم العميل ناقص.' };
  if (!cleanPhone) {
    return { ok: false, error: 'رقم الجوال غير صالح أو مفقود.' };
  }

  // Canonical SA form for storage — must match how unique_phone_wa rows are stored
  const phoneWa = canonicalizePhoneWa(cleanPhone) || cleanPhone;
  const email = String(leadRow.email ?? '').trim() || null;

  const upsertPayloads: Record<string, unknown>[] = [
    {
      name,
      phone_wa: phoneWa,
      email,
      client_type: 'عميل',
      intake_trip_type: 'group',
      lead_source: 'group_onboarding',
    },
    { name, phone_wa: phoneWa, email, client_type: 'عميل' },
    { name, phone_wa: phoneWa, client_type: 'عميل' },
    { name, phone_wa: phoneWa },
    { name, phone_wa: cleanPhone, client_type: 'عميل' },
    { name, phone_wa: cleanPhone },
  ];

  let lastError: string | null = null;

  for (const payload of upsertPayloads) {
    // No .single() — handle array/object safely (avoids crash + false "no id")
    const { data: clientData, error: upsertError } = await admin
      .from('clients')
      .upsert(payload, { onConflict: 'phone_wa', ignoreDuplicates: false })
      .select('id, name');

    if (upsertError) {
      lastError = formatClientDbError(upsertError);
      console.error('[groupApprove] clients.upsert:', lastError, payload);

      if (/column|schema cache|does not exist|check constraint|null value|intake_trip/i.test(upsertError.message ?? '')) {
        continue;
      }
      continue;
    }

    const clientId = extractClientId(clientData);
    if (!clientId) {
      return {
        ok: false,
        error: `فشل استخراج ID. البيانات المستلمة: ${JSON.stringify(clientData)}`,
      };
    }

    let clientName = name;
    if (Array.isArray(clientData) && clientData[0] && typeof clientData[0] === 'object') {
      const n = String((clientData[0] as { name?: unknown }).name ?? '').trim();
      if (n) clientName = n;
    } else if (clientData && typeof clientData === 'object' && 'name' in clientData) {
      const n = String((clientData as { name?: unknown }).name ?? '').trim();
      if (n) clientName = n;
    }

    return {
      ok: true,
      clientId,
      clientName,
      reusedExisting: true,
    };
  }

  return {
    ok: false,
    error: `خطأ في إنشاء/استرجاع العميل (Upsert): ${lastError || 'فشل غير معروف'}`,
  };
}

async function loadLeadDecisionRow(
  leadId: string,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  const id = String(leadId ?? '').trim();
  const selectAttempts = [
    'id, full_name, phone_wa, email, birth_date, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date, preferred_trip_id, media_consent, referral_code',
    'id, full_name, phone_wa, email, birth_date, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date, preferred_trip_id, media_consent',
    'id, full_name, phone_wa, email, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date, preferred_trip_id',
    'id, full_name, phone_wa, email, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date',
    'id, full_name, phone_wa, email, client_id, birth_date, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date, preferred_trip_id, media_consent, referral_code',
    'id, full_name, phone_wa, email, client_id, destinations, interests, daily_pace, food_preferences, final_thoughts, status, form_type, interview_date, preferred_trip_id',
  ];

  return fetchLeadRowById(admin, id, selectAttempts);
}

/**
 * Confirm trip exists in group_trips. IDs may be int8 (1, 2, …) or uuid.
 */
async function resolveApprovalTripId(
  admin: SupabaseClient,
  _leadRow: Record<string, unknown>,
  selectedTripId: string | undefined,
): Promise<{ ok: true; tripId: string } | { ok: false; error: string }> {
  const fromUi = String(selectedTripId ?? '').trim();
  if (!fromUi) return { ok: false, error: 'اختر رحلة جماعية قبل الموافقة.' };

  const idForQuery = /^\d+$/.test(fromUi) ? Number(fromUi) : fromUi;

  let { data, error } = await admin
    .from('group_trips')
    .select('id')
    .eq('id', idForQuery)
    .maybeSingle();

  if (error) {
    // Retry as string in case the column type differs
    const retry = await admin.from('group_trips').select('id').eq('id', fromUi).maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: 'الرحلة غير موجودة.' };

  return { ok: true, tripId: String(data.id) };
}

async function patchClientGroupMetadata(
  admin: SupabaseClient,
  clientId: ClientId,
  leadRow: Record<string, unknown>,
  decision: GroupLeadDecisionKind,
): Promise<void> {
  const destinations = Array.isArray(leadRow.destinations)
    ? (leadRow.destinations as unknown[]).map((v) => String(v).trim()).filter(Boolean)
    : [];
  const interests = extractLeadInterests(leadRow);
  const includeDnaFields = decision === 'approved' || decision === 'dna_submitted';
  const dnaPatch = includeDnaFields ? buildGroupLeadClientDnaPatch(leadRow) : {};

  const tags =
    decision === 'approved'
      ? ['group_trip_client', 'group_onboarding_approved']
      : decision === 'dna_submitted'
        ? ['group_trip_client', 'group_onboarding_dna']
        : decision === 'registration'
          ? ['group_trip_client', 'group_onboarding_registration']
          : ['marketing_archive', 'group_onboarding_archive'];

  // Merge with existing tags when reusing a returning customer
  let mergedTags = tags;
  try {
    const { data: existing } = await admin
      .from('clients')
      .select('tags')
      .eq('id', clientId)
      .limit(1);
    const prev = Array.isArray(existing?.[0]?.tags)
      ? (existing![0].tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
      : [];
    mergedTags = Array.from(new Set([...prev, ...tags]));
  } catch {
    /* ignore — tags column may be missing */
  }

  const updatePayload: Record<string, unknown> = {
    intake_trip_type: 'group',
    tags: mergedTags,
    lead_source:
      decision === 'marketing_archive' ? 'group_onboarding_archive' : 'group_onboarding',
    // DB check: client_type ∈ (عميل, مؤثر, ليدر) — never use English labels
    client_type: 'عميل',
    target_trip: destinations.join(' · ') || null,
    ...(includeDnaFields ? dnaPatch : {}),
  };

  if (decision === 'approved') {
    updatePayload.sales_stage = 'طلب انضمام جديد';
  } else if (decision === 'marketing_archive') {
    updatePayload.sales_stage = 'archived';
  }

  const birthDate = String(leadRow.birth_date ?? '').trim().slice(0, 10);
  if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    updatePayload.birth_date = birthDate;
  }

  const email = String(leadRow.email ?? '').trim();
  if (email) updatePayload.email = email;

  const leadName = String(leadRow.full_name ?? leadRow.name ?? '').trim();
  if (leadName) updatePayload.name = leadName;

  // Persist the referral code the lead used (do not overwrite client's own referral_code)
  if (decision === 'approved' || decision === 'dna_submitted') {
    const usedCode = extractReferralCodeFromLead(leadRow);
    if (usedCode) {
      updatePayload.used_code = usedCode;
    }
  }

  const { error } = await admin.from('clients').update(updatePayload).eq('id', clientId);
  if (error) {
    console.warn('[groupLeadDecision] metadata patch skipped:', error.message);
    const lean: Record<string, unknown> = {
      intake_trip_type: 'group',
      client_type: 'عميل',
    };
    if (decision === 'approved' || decision === 'dna_submitted') {
      lean.lead_source = 'group_onboarding';
      const usedCode = extractReferralCodeFromLead(leadRow);
      if (usedCode) lean.used_code = usedCode;
      if (includeDnaFields) {
        lean.dna_interests = dnaPatch.dna_interests;
        lean.dna_activity_level = dnaPatch.dna_activity_level;
        lean.food_allergies = dnaPatch.food_allergies;
        if (dnaPatch.dna_special_requests) {
          lean.dna_special_requests = dnaPatch.dna_special_requests;
        }
      }
    }
    if (leadName) lean.name = leadName;
    if (email) lean.email = email;
    if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) lean.birth_date = birthDate;
    const fallback = await admin.from('clients').update(lean).eq('id', clientId);
    if (fallback.error) {
      if (lean.used_code && /used_code|column|schema cache/i.test(fallback.error.message ?? '')) {
        delete lean.used_code;
        const retry = await admin.from('clients').update(lean).eq('id', clientId);
        if (retry.error) {
          console.warn('[groupLeadDecision] lean metadata fallback skipped:', retry.error.message);
        }
      } else {
        console.warn('[groupLeadDecision] lean metadata fallback skipped:', fallback.error.message);
      }
    }
  }

  if (includeDnaFields) {
    await patchClientDnaWithFallback(admin, clientId, leadRow);
    await upsertClientPreferencesInterests(admin, clientId, interests);
  }
}

/**
 * Upsert clients by phone_wa, sync DNA to CRM columns, link leads.client_id,
 * and touch group_members when a preferred trip is known (waitlist-safe).
 */
async function syncClientRecordFromGroupLead(
  leadId: string,
  options?: {
    phase?: 'registration' | 'dna';
    leadOverrides?: Record<string, unknown>;
  },
): Promise<{ ok: true; clientId: ClientId } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف غير صالح' };

  const phase = options?.phase ?? 'dna';

  const lead = await loadLeadDecisionRow(id);
  if (!lead.ok) return lead;

  const mergedRow: Record<string, unknown> = {
    ...lead.row,
    ...(options?.leadOverrides ?? {}),
  };

  let admin: SupabaseClient;
  try {
    admin = createApprovalAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const resolved = await resolveClientForGroupApproval(mergedRow, admin);
  if (!resolved.ok) return resolved;

  const { clientId, clientName } = resolved;

  await patchClientGroupMetadata(
    admin,
    clientId,
    mergedRow,
    phase === 'registration' ? 'registration' : 'dna_submitted',
  );

  const leadPhone = String(mergedRow.phone_wa ?? '').trim();
  const cleanPhone = leadPhone ? sanitizePhoneDigits(leadPhone) : '';
  const phoneWa = cleanPhone ? canonicalizePhoneWa(cleanPhone) || cleanPhone : '';

  const preferredTripId = String(mergedRow.preferred_trip_id ?? '').trim();
  if (preferredTripId) {
    const tripKey = /^\d+$/.test(preferredTripId) ? Number(preferredTripId) : preferredTripId;
    const clientKey = /^\d+$/.test(String(clientId)) ? Number(clientId) : clientId;

    const { data: existingMember } = await admin
      .from('group_members')
      .select('id, group_id, status')
      .eq('client_id', clientKey)
      .limit(1)
      .maybeSingle();

    const memberPayload: Record<string, unknown> = {
      client_id: clientKey,
      group_id: tripKey,
      status: 'waitlisted',
      payment_status: 'pending',
      customer_name: clientName || String(mergedRow.full_name ?? '').trim(),
    };
    if (phoneWa) memberPayload.customer_phone = phoneWa;

    if (existingMember) {
      const upd: Record<string, unknown> = {
        group_id: tripKey,
        customer_name: memberPayload.customer_name,
      };
      if (phoneWa) upd.customer_phone = phoneWa;
      const { error: updErr } = await admin
        .from('group_members')
        .update(upd)
        .eq('client_id', clientKey);
      if (updErr && !/column|schema cache|does not exist/i.test(updErr.message ?? '')) {
        console.warn('[group-dna] group_members update:', updErr.message);
      }
    } else {
      let { error: insErr } = await admin.from('group_members').insert(memberPayload);
      if (
        insErr &&
        /payment_status|customer_phone|customer_name|column|schema cache|does not exist/i.test(
          insErr.message ?? '',
        )
      ) {
        const lean = { client_id: clientKey, group_id: tripKey, status: 'waitlisted' };
        const retry = await admin.from('group_members').insert(lean);
        insErr = retry.error;
      }
      if (insErr && !(insErr.code === '23505' || /duplicate|unique/i.test(insErr.message ?? ''))) {
        console.warn('[group-dna] group_members insert:', insErr.message);
      }
    }
  }

  await safeLinkLeadClientId(admin, id, clientId);

  revalidatePath('/crm/clients');
  revalidatePath(`/crm/clients/${clientId}`);
  if (preferredTripId) {
    revalidatePath(`/crm/groups/${preferredTripId}`);
  }

  return { ok: true, clientId };
}

async function assignClientToTripWithSeatLogic(
  admin: SupabaseClient,
  clientId: ClientId,
  selectedTripId: string,
  contact?: { customerName?: string; customerPhone?: string; mediaConsent?: boolean | null },
): Promise<{ ok: true; status: 'confirmed_seat' | 'waitlisted'; tripTitle: string } | { ok: false; error: string }> {
  const tripIdRaw = String(selectedTripId ?? '').trim();
  if (!tripIdRaw) return { ok: false, error: 'اختر رحلة جماعية قبل الموافقة.' };

  const customerName = String(contact?.customerName ?? '').trim();
  const customerPhone = sanitizePhoneDigits(String(contact?.customerPhone ?? ''));
  const phoneWa = customerPhone ? canonicalizePhoneWa(customerPhone) || customerPhone : '';

  const capacity = await fetchGroupTripCapacity(admin, tripIdRaw);
  if (!capacity.ok) return { ok: false, error: capacity.error };
  if (!capacity.data.isActive) return { ok: false, error: 'الرحلة غير مفعّلة حالياً.' };

  const tripId = /^\d+$/.test(capacity.data.tripId)
    ? Number(capacity.data.tripId)
    : capacity.data.tripId;
  const tripTitle = capacity.data.titleAr;
  const confirmedCount = capacity.data.confirmedCount;

  // Already linked via junction table (live column is group_id)
  const { data: existingMember } = await admin
    .from('group_members')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('group_id', tripId)
    .limit(1)
    .maybeSingle();
  const alreadyOnTrip =
    existingMember != null &&
    String((existingMember as { status?: unknown }).status ?? '') === 'confirmed_seat';

  // Waitlist ONLY when confirmed seats hit max (unless already holding a confirmed seat)
  const hasCapacity = alreadyOnTrip || capacity.data.hasConfirmedCapacity;
  if (!hasCapacity && !capacity.data.allowWaitlist) {
    return { ok: false, error: 'الرحلة مكتملة وقائمة الانتظار غير مفعّلة.' };
  }
  const status: 'confirmed_seat' | 'waitlisted' = hasCapacity ? 'confirmed_seat' : 'waitlisted';
  const nextBooked =
    status === 'confirmed_seat' && !alreadyOnTrip ? confirmedCount + 1 : confirmedCount;
  const paymentDeadline =
    status === 'confirmed_seat' ? computePaymentDeadlineForBookedSeats(nextBooked) : null;

  const linkPayload: Record<string, unknown> = {
    client_id: clientId,
    group_id: tripId,
    status,
    payment_status: 'pending',
  };
  if (customerName) linkPayload.customer_name = customerName;
  if (phoneWa) linkPayload.customer_phone = phoneWa;
  if (paymentDeadline) linkPayload.payment_deadline = paymentDeadline;
  if (typeof contact?.mediaConsent === 'boolean') {
    linkPayload.media_consent = contact.mediaConsent;
  }

  const updateOnConflict = async (): Promise<string | null> => {
    const upd: Record<string, unknown> = {
      group_id: tripId,
      status,
      payment_status: 'pending',
    };
    if (customerName) upd.customer_name = customerName;
    if (phoneWa) upd.customer_phone = phoneWa;
    if (paymentDeadline) upd.payment_deadline = paymentDeadline;
    if (typeof contact?.mediaConsent === 'boolean') {
      upd.media_consent = contact.mediaConsent;
    }

    let { error: updErr } = await admin.from('group_members').update(upd).eq('client_id', clientId);
    if (updErr && /payment_deadline|media_consent|column|schema cache|does not exist/i.test(updErr.message ?? '')) {
      delete upd.payment_deadline;
      delete upd.media_consent;
      const retry = await admin.from('group_members').update(upd).eq('client_id', clientId);
      updErr = retry.error;
    }
    return updErr ? updErr.message : null;
  };

  let { error: linkError } = await admin.from('group_members').insert(linkPayload);

  if (linkError && /payment_deadline|media_consent|column|schema cache|does not exist/i.test(linkError.message ?? '')) {
    const lean = { ...linkPayload };
    delete lean.payment_deadline;
    delete lean.media_consent;
    const retry = await admin.from('group_members').insert(lean);
    linkError = retry.error;
  }

  if (linkError) {
    if (linkError.code === '23505' || /duplicate|unique/i.test(linkError.message ?? '')) {
      const updMsg = await updateOnConflict();
      if (updMsg) return { ok: false, error: `فشل ربط العميل بالرحلة: ${updMsg}` };
    } else {
      return { ok: false, error: `فشل ربط العميل بالرحلة: ${linkError.message}` };
    }
  }

  // Verify pivot
  const { data: verifyRows, error: verifyError } = await admin
    .from('group_members')
    .select('id, status, group_id')
    .eq('client_id', clientId)
    .limit(1);
  if (verifyError) return { ok: false, error: verifyError.message };
  const verified = (verifyRows?.[0] as Record<string, unknown>) ?? null;
  const linkedTripId = verified == null ? null : String(verified.group_id ?? '');
  if (!verified || linkedTripId !== String(tripId)) {
    return {
      ok: false,
      error: 'تعذر تأكيد ربط العميل بالرحلة الجماعية بعد الإدراج. أعد المحاولة أو عيّن الرحلة من ملف العميل.',
    };
  }

  if (status === 'confirmed_seat' && nextBooked !== confirmedCount) {
    const { error: tripUpdateError } = await admin
      .from('group_trips')
      .update({ booked_seats: nextBooked })
      .eq('id', tripId);
    if (tripUpdateError) return { ok: false, error: tripUpdateError.message };

    if (crossesScarcityThreshold(confirmedCount, nextBooked)) {
      const deadline = new Date(Date.now() + PAYMENT_GRACE_MS).toISOString();
      await admin
        .from('group_members')
        .update({ payment_deadline: deadline, updated_at: new Date().toISOString() })
        .eq('group_id', tripId)
        .eq('status', 'confirmed_seat')
        .eq('payment_status', 'pending')
        .is('payment_deadline', null);
    }
  }

  return { ok: true, status, tripTitle };
}

async function finalizeLeadDecision(
  leadId: string,
  decision: GroupLeadDecisionKind,
  selectedTripId?: string,
): Promise<GroupLeadDecisionResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  let admin: SupabaseClient;
  try {
    admin = createApprovalAdminClient();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const lead = await loadLeadDecisionRow(id);
  if (!lead.ok) return lead;

  // Full admin path: find/create → metadata → group_members → delete lead
  const resolved = await resolveClientForGroupApproval(lead.row, admin);
  if (!resolved.ok) return resolved;

  const { clientId, clientName, reusedExisting } = resolved;

  await patchClientGroupMetadata(admin, clientId, lead.row, decision);

  let assignedTripTitle = '';
  let assignedStatus: 'confirmed_seat' | 'waitlisted' | '' = '';
  let resolvedTripId = String(selectedTripId ?? '').trim();
  let commissionCredited = false;
  let commissionAmount = 0;
  if (decision === 'approved') {
    const leadPhone = String(lead.row.phone_wa ?? '').trim();
    const tripResolved = await resolveApprovalTripId(admin, lead.row, selectedTripId);
    if (!tripResolved.ok) return tripResolved;
    resolvedTripId = tripResolved.tripId;

    const leadMediaConsent =
      typeof lead.row.media_consent === 'boolean' ? lead.row.media_consent : null;
    const assignResult = await assignClientToTripWithSeatLogic(
      admin,
      clientId,
      resolvedTripId,
      {
        customerName: clientName || String(lead.row.full_name ?? '').trim(),
        customerPhone: leadPhone,
        mediaConsent: leadMediaConsent,
      },
    );
    if (!assignResult.ok) return assignResult;
    assignedTripTitle = assignResult.tripTitle;
    assignedStatus = assignResult.status;

    // Credit referrer Smart Wallet (leader/expert pending) or client VIP wallet
    const referralCode = extractReferralCodeFromLead(lead.row);
    if (referralCode) {
      try {
        const reward = await processReferralCommissionOnLeadApproval(admin, {
          referralCode,
          clientId,
          clientName: clientName || String(lead.row.full_name ?? '').trim(),
          leadId: id,
        });
        if (reward.processed) {
          commissionCredited = true;
          commissionAmount = reward.amount ?? 150;
          console.info(
            `[groupLeadDecision] referral commission ${reward.amount} SAR → ${reward.referrerRole}:${reward.referrerId}`,
          );
        } else if (reward.reason && reward.reason !== 'already_credited') {
          console.warn('[groupLeadDecision] referral commission skipped:', reward.reason);
        }
      } catch (commissionErr) {
        console.error('[groupLeadDecision] referral commission error:', commissionErr);
      }
    }
  }

  const { error: deleteError } = await admin.from('leads').delete().eq('id', id);
  if (deleteError) {
    const fallback = await admin
      .from('leads')
      .update({
        status: decision === 'approved' ? 'converted' : 'postponed',
        client_id: clientId,
        final_thoughts: `${String(lead.row.final_thoughts ?? '').trim()}\n[decision:${decision}] client:${clientId}`.trim(),
      })
      .eq('id', id);
    if (fallback.error) {
      return {
        ok: false,
        error: `تم الربط بالرحلة بنجاح ولكن فشل إخفاء الطلب: ${fallback.error.message}`,
      };
    }
  }

  revalidatePath('/crm/radar');
  revalidatePath('/crm/clients');
  revalidatePath(`/crm/clients/${clientId}`);
  if (resolvedTripId) {
    revalidatePath(`/crm/groups/${resolvedTripId}`);
  }

  const seatLabel =
    assignedStatus === 'confirmed_seat'
      ? 'مقعد مؤكد'
      : assignedStatus === 'waitlisted'
        ? 'قائمة انتظار'
        : '';

  if (decision === 'approved') {
    const tripPart = assignedTripTitle
      ? ` — «${assignedTripTitle}»${seatLabel ? ` (${seatLabel})` : ''}`
      : '';
    const commissionPart = commissionCredited
      ? ` — وتم ترحيل عمولة الإحالة (${commissionAmount} ر.س) للمحفظة`
      : '';
    return {
      ok: true,
      clientId,
      message: reusedExisting
        ? `تم ربط الرحلة بنجاح بالعميل: ${clientName}${tripPart}${commissionPart}`
        : `تمت الموافقة وترحيل العميل بنجاح! ${clientName}${tripPart}${commissionPart}`,
    };
  }

  return {
    ok: true,
    clientId,
    message: `تمت أرشفة الطلب وربطه بملف العميل: ${clientName}`,
  };
}

export async function approveGroupLead(input: {
  leadId: string;
  tripId: string;
}): Promise<GroupLeadDecisionResult> {
  const leadId = String(input?.leadId ?? '').trim();
  const tripId = String(input?.tripId ?? '').trim();
  return finalizeLeadDecision(leadId, 'approved', tripId);
}

export async function archiveGroupLead(leadId: string): Promise<GroupLeadDecisionResult> {
  return finalizeLeadDecision(leadId, 'marketing_archive');
}

export async function deleteGroupLead(leadId: string): Promise<GroupLeadDecisionResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('leads').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/crm/radar');
  return { ok: true, message: 'تم حذف الطلب نهائياً من النظام.' };
}

/**
 * Manual CRM override — writes only leads.meeting_date (timestamptz).
 * Pass ISO / parseable datetime to set, or null/empty to clear.
 */
export async function setLeadMeetingDateManual(
  leadId: string,
  meetingDateIso: string | null,
): Promise<{ ok: true; meeting_date: string | null } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const raw = meetingDateIso == null ? '' : String(meetingDateIso).trim();
  const supabase = createSupabaseAdminClient();

  let selectedDate: string | null = null;
  if (raw) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'صيغة التاريخ غير صالحة.' };
    }
    selectedDate = parsed.toISOString();
  }

  const { error } = await supabase
    .from('leads')
    .update({ meeting_date: selectedDate })
    .eq('id', id);

  if (error) {
    console.error('[setLeadMeetingDateManual]', error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath('/crm/radar');
  return { ok: true, meeting_date: selectedDate };
}

/**
 * Cal.com handles the actual slot externally — marks the CRM lead as
 * interview_scheduled after the guest confirms they booked.
 * When the Cal embed fires bookingSuccessfulV2, pass interviewDate/interviewTime.
 * Never overwrite a previously saved slot with the `cal.com` placeholder.
 */
export async function confirmInterviewBooked(
  leadId: string,
  payload?: ConfirmInterviewBookedPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(leadId ?? '').trim();
  if (!id) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('leads')
    .select('interview_date, interview_time, final_thoughts, status, meeting_date')
    .eq('id', id)
    .maybeSingle();

  const existingRow = (existing ?? null) as Record<string, unknown> | null;
  const inboxPending = isInboxPendingLeadStatus(existingRow?.status);

  const existingDate = String(existingRow?.interview_date ?? '').trim().slice(0, 10);
  const existingTimeRaw = String(existingRow?.interview_time ?? '').trim();
  const existingTime =
    existingTimeRaw && existingTimeRaw.toLowerCase() !== 'cal.com' ? existingTimeRaw : '';

  let interviewDate = String(payload?.interviewDate ?? '').trim().slice(0, 10) || existingDate;
  let interviewTime = String(payload?.interviewTime ?? '').trim();
  if (!interviewTime || interviewTime.toLowerCase() === 'cal.com') {
    interviewTime = existingTime;
  }

  // Recover from notes if columns empty
  if ((!interviewDate || !interviewTime) && existingRow?.final_thoughts) {
    const { parseInterviewFromFinalThoughts } = await import('@/lib/crm-leads');
    const fromNotes = parseInterviewFromFinalThoughts(String(existingRow.final_thoughts));
    if (fromNotes) {
      if (!interviewDate) interviewDate = fromNotes.interviewDate;
      if (!interviewTime) interviewTime = fromNotes.interviewTime;
    }
  }

  const hasSlot = Boolean(interviewDate && interviewTime && interviewTime.toLowerCase() !== 'cal.com');

  const bookedNote = hasSlot
    ? `مقابلة مجدولة: ${interviewDate} ${interviewTime}`
    : `مقابلة مجدولة عبر Cal.com — ${new Date().toISOString().slice(0, 10)}`;

  const existingThoughts =
    existingRow?.final_thoughts != null ? String(existingRow.final_thoughts) : '';

  // When confirm has no captured slot, keep status as meeting if already meeting
  // but never invent a fake "cal.com" time — leave time empty so CRM shows "لم يتم تحديد".
  const updatePayload: Record<string, string> = {};
  if (!inboxPending) {
    updatePayload.status = hasSlot ? 'interview_scheduled' : 'meeting';
  }
  if (hasSlot) {
    updatePayload.final_thoughts = mergeInterviewNote(existingThoughts, bookedNote);
    updatePayload.interview_date = interviewDate;
    updatePayload.interview_time = interviewTime;
    const meetingIso = `${interviewDate}T${toIsoTimeHint(interviewTime)}`;
    const meetingTs = new Date(meetingIso);
    if (!Number.isNaN(meetingTs.getTime())) {
      updatePayload.meeting_date = meetingTs.toISOString();
    }
  } else if (interviewDate) {
    updatePayload.interview_date = interviewDate;
    updatePayload.final_thoughts = mergeInterviewNote(existingThoughts, bookedNote);
  } else {
    updatePayload.final_thoughts = mergeInterviewNote(existingThoughts, bookedNote);
  }

  const { error } = await admin
    .from('leads')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error('[confirmInterviewBooked]', error.message);
    // Columns may be missing — status-only / notes fallback
    if (/interview_|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const fallbackPayload: Record<string, string> = {
        final_thoughts: mergeInterviewNote(existingThoughts, bookedNote),
      };
      if (!inboxPending) {
        fallbackPayload.status = 'interview_scheduled';
      }
      const fallback = await admin.from('leads').update(fallbackPayload).eq('id', id);
      if (fallback.error) {
        if (!inboxPending) {
          const statusOnly = await admin
            .from('leads')
            .update({ status: 'interview_scheduled' })
            .eq('id', id);
          if (statusOnly.error) {
            return { ok: false, error: statusOnly.error.message };
          }
        }
      }
    } else if (/final_thoughts/i.test(error.message ?? '')) {
      const withoutNotes = { ...updatePayload };
      delete withoutNotes.final_thoughts;
      const retry = await admin.from('leads').update(withoutNotes).eq('id', id);
      if (retry.error) {
        return { ok: false, error: retry.error.message };
      }
    } else if (/check constraint|status/i.test(error.message ?? '')) {
      return {
        ok: false,
        error: error.message,
      };
    } else {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath('/crm/radar');
  revalidatePath('/crm');
  return { ok: true };
}

export type GroupDirectBookingResult =
  | {
      ok: true;
      clientId: ClientId;
      checkoutPath: string;
      placement: 'confirmed_seat' | 'waitlisted';
      message: string;
      fullName: string;
      tripTitle: string;
    }
  | { ok: false; error: string };

async function resolveTripIdForDirectBooking(
  admin: SupabaseClient,
  leadRow: Record<string, unknown>,
): Promise<{ ok: true; tripId: string } | { ok: false; error: string }> {
  const preferredCol = String(leadRow.preferred_trip_id ?? '').trim();
  if (preferredCol) {
    return resolveApprovalTripId(admin, leadRow, preferredCol);
  }

  const fromNotes = parsePreferredTripIdLoose(
    leadRow.final_thoughts != null ? String(leadRow.final_thoughts) : null,
  );
  if (fromNotes) {
    return resolveApprovalTripId(admin, leadRow, fromNotes);
  }

  const { data: trips, error } = await admin
    .from('group_trips')
    .select('id, title_ar')
    .eq('is_active', true);

  if (error) {
    return { ok: false, error: error.message };
  }

  const tripOptions = (trips ?? []).map((row) => ({
    id: String((row as { id?: unknown }).id ?? ''),
    title_ar: String((row as { title_ar?: unknown }).title_ar ?? ''),
  }));

  const resolvedId = resolveLeadBookedTripId(
    {
      preferred_trip_id:
        leadRow.preferred_trip_id != null ? String(leadRow.preferred_trip_id) : null,
      final_thoughts: leadRow.final_thoughts != null ? String(leadRow.final_thoughts) : '',
      destinations: Array.isArray(leadRow.destinations)
        ? (leadRow.destinations as unknown[]).map(String)
        : [],
    },
    tripOptions,
  );

  if (!resolvedId) {
    return {
      ok: false,
      error: 'تعذر تحديد الرحلة المرتبطة بطلبك. تواصل مع فريق Wanderloom للمساعدة.',
    };
  }

  return resolveApprovalTripId(admin, leadRow, resolvedId);
}

/**
 * Self-service fast track — skip optional interview, accept terms, convert to client,
 * assign trip seat, and return checkout path when a confirmed seat is available.
 */
export async function confirmGroupDirectBooking(
  leadId: string,
  agreedToTerms: boolean,
  mediaConsent = true,
): Promise<GroupDirectBookingResult> {
  const id = String(leadId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الطلب غير صالح.' };
  if (!agreedToTerms) {
    return { ok: false, error: 'يرجى الموافقة على شروط وأحكام الرحلة الجماعية قبل المتابعة.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const lead = await loadLeadDecisionRow(id);
  if (!lead.ok) return lead;

  let admin: SupabaseClient;
  try {
    admin = createApprovalAdminClient();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const tripResolved = await resolveTripIdForDirectBooking(admin, lead.row);
  if (!tripResolved.ok) return tripResolved;

  const fullName = String(lead.row.full_name ?? '').trim() || 'مسافر';
  const tripKey = /^\d+$/.test(tripResolved.tripId)
    ? Number(tripResolved.tripId)
    : tripResolved.tripId;
  const { data: tripRow } = await admin
    .from('group_trips')
    .select('title_ar')
    .eq('id', tripKey)
    .maybeSingle();
  const tripTitle = String((tripRow as { title_ar?: unknown } | null)?.title_ar ?? '').trim() || 'رحلة جماعية';

  const existingThoughts =
    lead.row.final_thoughts != null ? String(lead.row.final_thoughts) : '';
  const termsNote = `موافقة على دليل الرحلة وميثاق التفاهم المشترك — ${new Date().toISOString().slice(0, 10)}`;
  const mergedThoughts = existingThoughts
    ? `${existingThoughts}\n${termsNote}`
    : termsNote;

  const leadUpdatePayload: Record<string, unknown> = {
    final_thoughts: preserveGroupOnboardingThoughts(existingThoughts, mergedThoughts),
    media_consent: mediaConsent,
  };
  let { error: termsError } = await admin.from('leads').update(leadUpdatePayload).eq('id', id);
  if (
    termsError &&
    /media_consent|column|schema cache|does not exist/i.test(termsError.message ?? '')
  ) {
    const retry = await admin
      .from('leads')
      .update({
        final_thoughts: preserveGroupOnboardingThoughts(existingThoughts, mergedThoughts),
      })
      .eq('id', id);
    termsError = retry.error;
  }

  if (termsError && !/final_thoughts|column|schema cache/i.test(termsError.message ?? '')) {
    return { ok: false, error: termsError.message };
  }

  const decision = await finalizeLeadDecision(id, 'approved', tripResolved.tripId);
  if (!decision.ok) return decision;

  const clientId = decision.clientId;
  if (clientId == null || clientId === '') {
    return { ok: false, error: 'تم تأكيد الطلب ولكن تعذر إنشاء ملف العميل.' };
  }

  const { data: memberRow } = await admin
    .from('group_members')
    .select('status')
    .eq('client_id', clientId)
    .eq('group_id', /^\d+$/.test(tripResolved.tripId) ? Number(tripResolved.tripId) : tripResolved.tripId)
    .maybeSingle();

  const memberStatus = String((memberRow as { status?: unknown } | null)?.status ?? '').trim();
  const placement: 'confirmed_seat' | 'waitlisted' =
    memberStatus === 'waitlisted' ? 'waitlisted' : 'confirmed_seat';

  if (placement === 'confirmed_seat') {
    await admin
      .from('clients')
      .update({ sales_stage: SALES_STAGE_PENDING_PAYMENT })
      .eq('id', clientId);
  }

  const checkoutPath = `/checkout/${clientId}`;
  const message =
    placement === 'waitlisted'
      ? 'تم تسجيل طلبك في قائمة الانتظار. سنتواصل معك فور توفر مقعد.'
      : 'تم تأكيد حجزك! أكمل خطوة الدفع لتثبيت مقعدك.';

  revalidatePath('/crm/radar');
  revalidatePath(`/checkout/${clientId}`);

  return {
    ok: true,
    clientId,
    checkoutPath: placement === 'confirmed_seat' ? checkoutPath : '',
    placement,
    message,
    fullName,
    tripTitle,
  };
}
