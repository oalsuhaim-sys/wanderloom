import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { INTEREST_ONLY_DB_VALUES, INTEREST_ONLY_STATUS } from '@/lib/lead-status';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type SupabaseInsertError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function formatInsertError(error: SupabaseInsertError): string {
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  return parts.join(' — ') || 'Unknown database error';
}

function isStatusConstraintError(message: string): boolean {
  return /status|check constraint|interest_only|interest/i.test(message);
}

function isMissingColumnError(message: string): boolean {
  return /column|schema cache|does not exist|referral_code/i.test(message);
}

export type InterestLeadInput = {
  fullName: string;
  phoneWa: string;
  destination: string;
  referralCode?: string | null;
};

function buildInterestLeadRow(input: InterestLeadInput, status?: string) {
  const destinations = input.destination ? [input.destination] : [];
  const referralCode =
    String(input.referralCode ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 64) || null;
  const referralNote = referralCode ? ` · كود الإحالة: ${referralCode}` : '';
  const finalThoughts = input.destination
    ? `تسجيل اهتمام — الوجهة المفضلة: ${input.destination}${referralNote}`
    : `تسجيل اهتمام — بدون وجهة محددة${referralNote}`;

  const row: Record<string, unknown> = {
    full_name: input.fullName,
    email: null,
    phone_wa: input.phoneWa,
    age: null,
    destinations,
    travel_date: null,
    travel_days: 7,
    travelers_count: 1,
    budget: null,
    interests: ['تسجيل اهتمام'],
    travel_style: 'Private',
    lead_source: 'website',
    daily_pace: null,
    walking_readiness: null,
    day_start_time: null,
    food_preferences: [],
    accommodation_type: [],
    final_thoughts: finalThoughts,
    form_type: 'contact',
  };

  if (referralCode) row.referral_code = referralCode;
  if (status) row.status = status;
  return row;
}

function buildMinimalInterestLeadRow(input: InterestLeadInput, status?: string) {
  const destinations = input.destination ? [input.destination] : [];
  const referralCode =
    String(input.referralCode ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 64) || null;
  const referralNote = referralCode ? ` · كود الإحالة: ${referralCode}` : '';
  const finalThoughts = input.destination
    ? `تسجيل اهتمام — الوجهة المفضلة: ${input.destination}${referralNote}`
    : `تسجيل اهتمام — بدون وجهة محددة${referralNote}`;

  const row: Record<string, unknown> = {
    full_name: input.fullName,
    phone_wa: input.phoneWa,
    destinations,
    travel_days: 7,
    travelers_count: 1,
    interests: ['تسجيل اهتمام'],
    travel_style: 'Private',
    food_preferences: [],
    accommodation_type: [],
    final_thoughts: finalThoughts,
    form_type: 'contact',
  };

  if (referralCode) row.referral_code = referralCode;
  if (status) row.status = status;
  return row;
}

export async function insertInterestLeadAdmin(
  input: InterestLeadInput,
): Promise<{ ok: true; leadId: string; statusUsed: string } | { ok: false; error: string }> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    console.error('[insertInterestLead] missing service role key');
    return { ok: false, error: serviceKeyError };
  }

  const phoneWa = canonicalizePhoneWa(input.phoneWa) || input.phoneWa;
  const normalized: InterestLeadInput = { ...input, phoneWa };
  const admin = createSupabaseAdminClient();
  const statusAttempts = [...INTEREST_ONLY_DB_VALUES, 'new', 'radar_pending'];

  for (const status of statusAttempts) {
    const { data, error } = await admin
      .from('leads')
      .insert(buildInterestLeadRow(normalized, status) as never)
      .select('id')
      .single();

    if (!error && data?.id) {
      return { ok: true, leadId: String(data.id), statusUsed: status };
    }

    console.error(
      `[insertInterestLead] full insert failed (status=${status}):`,
      formatInsertError(error ?? {}),
    );

    if (error && !isStatusConstraintError(error.message ?? '') && !isMissingColumnError(error.message ?? '')) {
      break;
    }
  }

  for (const status of statusAttempts) {
    const { data, error } = await admin
      .from('leads')
      .insert(buildMinimalInterestLeadRow(normalized, status) as never)
      .select('id')
      .single();

    if (!error && data?.id) {
      return { ok: true, leadId: String(data.id), statusUsed: status };
    }

    console.error(
      `[insertInterestLead] minimal insert failed (status=${status}):`,
      formatInsertError(error ?? {}),
    );

    if (error && !isStatusConstraintError(error.message ?? '') && !isMissingColumnError(error.message ?? '')) {
      break;
    }
  }

  const { data, error } = await admin
    .from('leads')
    .insert(buildMinimalInterestLeadRow(normalized) as never)
    .select('id')
    .single();

  if (!error && data?.id) {
    console.warn('[insertInterestLead] inserted without status column');
    return { ok: true, leadId: String(data.id), statusUsed: INTEREST_ONLY_STATUS };
  }

  console.error('[insertInterestLead] final insert failed:', formatInsertError(error ?? {}));
  return {
    ok: false,
    error: error ? `تعذّر الحفظ: ${formatInsertError(error)}` : 'تعذّر الحفظ في قاعدة البيانات',
  };
}
