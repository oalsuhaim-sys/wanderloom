import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type GroupLeadInsertInput = {
  fullName: string;
  phoneWa: string;
  email?: string | null;
  age: number;
  /** yyyy-mm-dd — stored in notes / optional lead column */
  birthDate?: string | null;
  tripLabel: string;
  /** Direct registration link trip UUID */
  preferredTripId?: string | null;
  /** How they heard about us → leads.lead_source */
  leadSource?: string | null;
  /** Optional affiliate / partner referral code */
  referralCode?: string | null;
};

type InsertError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function formatError(error: InsertError | null | undefined): string {
  if (!error) return 'Unknown insert error';
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' — ');
}

function isConstraintOrColumnError(message: string): boolean {
  return /check constraint|form_type|status|column|schema cache|does not exist|violates|birth_date|age|referral_code/i.test(
    message,
  );
}

/**
 * Inserts a group-trip application into `leads` with service_role (bypasses RLS).
 * Tries progressively safer payloads until one succeeds.
 */
export async function insertGroupTripLeadAdmin(
  input: GroupLeadInsertInput,
): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    console.error('Supabase Form Error:', serviceKeyError);
    return { ok: false, error: serviceKeyError };
  }

  const admin = createSupabaseAdminClient();
  const phoneWa = canonicalizePhoneWa(input.phoneWa) || input.phoneWa;
  const tripLabel = input.tripLabel.trim();
  const email = String(input.email ?? '').trim() || null;
  const birthDate = String(input.birthDate ?? '').trim().slice(0, 10) || null;
  const preferredTripId = String(input.preferredTripId ?? '').trim() || null;
  const preferredTripIdSafe =
    preferredTripId &&
    (/^\d+$/.test(preferredTripId) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        preferredTripId,
      ))
      ? preferredTripId
      : null;
  const preferredNote = preferredTripIdSafe ? ` · preferred_trip:${preferredTripIdSafe}` : '';
  const birthNote = birthDate ? ` · تاريخ الميلاد: ${birthDate}` : '';
  const referralCode =
    String(input.referralCode ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 64) || null;
  const referralNote = referralCode ? ` · كود الإحالة: ${referralCode}` : '';
  const finalThoughts = `طلب انضمام لرحلة جماعية · ${tripLabel} · العمر: ${input.age}${birthNote}${preferredNote}${referralNote}`;
  const leadSource = String(input.leadSource ?? '').trim() || 'website';

  const withPreferred = (row: Record<string, unknown>): Record<string, unknown> =>
    preferredTripIdSafe ? { ...row, preferred_trip_id: preferredTripIdSafe } : row;

  const withSource = (row: Record<string, unknown>): Record<string, unknown> => ({
    ...row,
    lead_source: leadSource,
  });

  const withBirth = (row: Record<string, unknown>): Record<string, unknown> =>
    birthDate ? { ...row, birth_date: birthDate } : row;

  const withReferral = (row: Record<string, unknown>): Record<string, unknown> =>
    referralCode ? { ...row, referral_code: referralCode } : row;

  const baseContact = withReferral({
    full_name: input.fullName.trim(),
    email,
    phone_wa: phoneWa,
    age: input.age,
  });

  const attempts: Record<string, unknown>[] = [
    // Preferred: group onboarding funnel (canonical travel_style + lead_source)
    withSource(
      withPreferred(
        withBirth({
          ...baseContact,
          destinations: [tripLabel],
          travel_date: null,
          travel_days: 7,
          travelers_count: 1,
          budget: null,
          interests: ['رحلة جماعية'],
          travel_style: 'Group',
          daily_pace: null,
          walking_readiness: null,
          day_start_time: null,
          food_preferences: [],
          accommodation_type: [],
          final_thoughts: finalThoughts,
          form_type: 'group_trip',
          status: 'pending',
        }),
      ),
    ),
    // lead_source column missing
    withPreferred(
      withBirth({
        ...baseContact,
        destinations: [tripLabel],
        travel_date: null,
        travel_days: 7,
        travelers_count: 1,
        budget: null,
        interests: ['رحلة جماعية'],
        travel_style: 'Group',
        daily_pace: null,
        walking_readiness: null,
        day_start_time: null,
        food_preferences: [],
        accommodation_type: [],
        final_thoughts: finalThoughts,
        form_type: 'group_trip',
        status: 'pending',
      }),
    ),
    // preferred_trip_id column missing — keep notes marker
    withSource(
      withBirth({
        ...baseContact,
        destinations: [tripLabel],
        travel_date: null,
        travel_days: 7,
        travelers_count: 1,
        budget: null,
        interests: ['رحلة جماعية'],
        travel_style: 'Group',
        daily_pace: null,
        walking_readiness: null,
        day_start_time: null,
        food_preferences: [],
        accommodation_type: [],
        final_thoughts: finalThoughts,
        form_type: 'group_trip',
        status: 'pending',
      }),
    ),
    // form_type not migrated yet — keep Group style + pending inbox
    withPreferred(
      withBirth({
        ...baseContact,
        destinations: [tripLabel],
        travel_days: 7,
        travelers_count: 1,
        interests: ['رحلة جماعية'],
        travel_style: 'Group',
        food_preferences: [],
        accommodation_type: [],
        final_thoughts: finalThoughts,
        form_type: 'contact',
        status: 'pending',
      }),
    ),
    // status not migrated / check constraint
    withBirth({
      ...baseContact,
      destinations: [tripLabel],
      travel_days: 7,
      travelers_count: 1,
      interests: ['رحلة جماعية'],
      travel_style: 'Group',
      food_preferences: [],
      accommodation_type: [],
      final_thoughts: finalThoughts,
      form_type: 'contact',
      status: 'radar_pending',
    }),
    // Legacy status values from original leads.sql
    {
      ...baseContact,
      destinations: [tripLabel],
      travel_days: 7,
      travelers_count: 1,
      interests: ['رحلة جماعية'],
      travel_style: 'Group',
      food_preferences: [],
      accommodation_type: [],
      final_thoughts: finalThoughts,
      form_type: 'contact',
      status: 'new',
    },
    // Absolute minimum required columns (notes still carry group markers)
    withReferral({
      full_name: input.fullName.trim(),
      phone_wa: phoneWa,
      email,
      destinations: [tripLabel],
      travel_days: 7,
      travelers_count: 1,
      interests: ['رحلة جماعية'],
      food_preferences: [],
      accommodation_type: [],
      final_thoughts: finalThoughts,
      form_type: 'contact',
      status: 'new',
    }),
  ];

  let lastError = '';

  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await admin
      .from('leads')
      .insert(attempts[i] as never)
      .select('id')
      .single();

    if (!error && data?.id) {
      console.info('[insertGroupTripLead] saved', { leadId: data.id, attempt: i + 1 });
      // Hard guarantee: new direct onboarding lands in inbox as pending
      const statusPatch = await admin
        .from('leads')
        .update({ status: 'pending', form_type: 'group_trip', travel_style: 'Group' })
        .eq('id', data.id);
      if (statusPatch.error) {
        await admin.from('leads').update({ status: 'pending' }).eq('id', data.id);
      }
      return { ok: true, leadId: String(data.id) };
    }

    lastError = formatError(error);
    console.error('Supabase Form Error:', lastError);

    if (error && !isConstraintOrColumnError(error.message ?? '')) {
      break;
    }
  }

  return {
    ok: false,
    error: lastError || 'تعذّر حفظ الطلب في جدول leads',
  };
}
