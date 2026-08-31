'use server';

import { revalidatePath } from 'next/cache';

import { tripLeadInsertUserMessage } from '@/lib/i18n/db-error-message';
import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { runRegistrationAutomationPipeline } from '@/lib/registration-automation';
import { ar } from '@/messages/ar';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseClient } from '@/lib/supabaseClient';
import type { SessionRegistration } from '@/types/session-tables';

export type RegisterSessionActionResult =
  | { ok: true; data: SessionRegistration; spotsRemaining?: number; demo?: boolean }
  | { ok: false; error: string };

function toArabicSessionError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === '23505' || m.includes('duplicate') || m.includes('unique')) {
    return ar.errors.session.duplicateWhatsapp;
  }
  if (m.includes('foreign key') || m.includes('violates foreign key')) {
    return ar.errors.session.sessionNotFound;
  }
  if (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('econnrefused') ||
    m.includes('failed to fetch')
  ) {
    return ar.errors.trip.dbConnection;
  }
  return `${ar.errors.session.genericRegistration} (${ar.errors.session.saveRegistrationFailed})`;
}

function getWriteClient() {
  try {
    if ((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()) {
      return createSupabaseAdminClient();
    }
  } catch {
    /* fall through to anon */
  }
  return supabaseClient;
}

/** CRM lead payload — only Name + WhatsApp from the form; rest are smart defaults. */
function buildSessionLeadPayload(input: {
  name: string;
  whatsapp: string;
  session_id: string;
  sessionTitle: string;
}) {
  const title = input.sessionTitle.trim() || 'جلسة';
  const destinationLabel = 'غير محدد (تسجيل جلسة)';

  return {
    full_name: input.name,
    phone_wa: input.whatsapp,
    email: null as string | null,
    age: null as number | null,
    destinations: [destinationLabel],
    travel_date: null as string | null,
    travel_days: 7,
    travelers_count: 1,
    budget: null as string | null,
    interests: ['تسجيل جلسة'],
    travel_style: 'Private' as const,
    lead_source: 'other' as const,
    daily_pace: null as string | null,
    walking_readiness: null as string | null,
    day_start_time: null as string | null,
    food_preferences: [] as string[],
    accommodation_type: [] as string[],
    final_thoughts: `تسجيل من جلسة: ${title}`,
    form_type: 'contact' as const,
    status: 'radar_pending' as const,
    source: 'Session Registration',
    destination_dream: `اهتمام بالجلسة: ${title}`,
    city: null as string | null,
    travel_window: null as string | null,
    trip_style: null as string | null,
    budget_range: null as string | null,
    interests_notes: `جلسة: ${title}`,
    dream_closing: null as string | null,
    travel_start_date: null as string | null,
    trip_form: {
      lead_source: 'other',
      session_id: input.session_id,
      session_title: title,
      source: 'Session Registration',
    },
  };
}

async function insertCrmInterestProfile(input: {
  name: string;
  whatsapp: string;
  session_id: string;
  sessionTitle: string;
}): Promise<
  | { ok: true; leadId: string | null }
  | { ok: false; message: string; leadId?: null }
> {
  const db = getWriteClient();
  if (!db) {
    return { ok: false, message: 'supabase unavailable' };
  }

  const payload = buildSessionLeadPayload(input);

  // Primary CRM table used by radar / website intake
  let { data: leadRow, error: leadsErr } = await db
    .from('leads')
    .insert({
      full_name: payload.full_name,
      email: payload.email,
      phone_wa: payload.phone_wa,
      age: payload.age,
      destinations: payload.destinations,
      travel_date: payload.travel_date,
      travel_days: payload.travel_days,
      travelers_count: payload.travelers_count,
      budget: payload.budget,
      interests: payload.interests,
      travel_style: payload.travel_style,
      lead_source: payload.lead_source,
      daily_pace: payload.daily_pace,
      walking_readiness: payload.walking_readiness,
      day_start_time: payload.day_start_time,
      food_preferences: payload.food_preferences,
      accommodation_type: payload.accommodation_type,
      final_thoughts: payload.final_thoughts,
      form_type: payload.form_type,
      status: payload.status,
    } as never)
    .select('id')
    .single();

  if (leadsErr) {
    console.warn('[registerSession] leads insert failed, retrying minimal row:', leadsErr.message);
    ({ data: leadRow, error: leadsErr } = await db
      .from('leads')
      .insert({
        full_name: payload.full_name,
        phone_wa: payload.phone_wa,
        email: null,
        destinations: payload.destinations,
        travel_days: 7,
        travelers_count: 1,
        interests: [],
        travel_style: 'Private',
        food_preferences: [],
        accommodation_type: [],
        final_thoughts: payload.final_thoughts,
        form_type: 'contact',
        status: 'radar_pending',
      } as never)
      .select('id')
      .single());
  }

  if (!leadsErr) {
    return {
      ok: true,
      leadId: leadRow?.id != null ? String(leadRow.id) : null,
    };
  }

  // Legacy fallback: customers table
  const { error: custErr } = await db.from('customers').insert({
    full_name: payload.full_name,
    phone_wa: payload.phone_wa,
    email: null,
    city: null,
    destination_dream: payload.destination_dream,
    travel_window: null,
    travelers_count: 1,
    trip_style: null,
    budget_range: null,
    interests_notes: payload.interests_notes,
    source: payload.source,
    status: 'new',
    travel_days: 7,
    travel_start_date: null,
    dream_closing: null,
    trip_form: payload.trip_form,
  } as never);

  if (!custErr) return { ok: true, leadId: null };

  console.error('[registerSession] CRM profile insert failed:', {
    leads: leadsErr.message,
    customers: custErr.message,
  });
  return {
    ok: false,
    message: custErr.message || leadsErr.message || 'crm insert failed',
    leadId: null,
  };
}

/**
 * تسجيل عميل في جلسة: إدراج في session_registrations، إنقاص spots بمقدار 1،
 * وإنشاء Lead في CRM (leads / customers) بقيم افتراضية آمنة.
 */
export async function registerSessionAction(input: {
  session_id: string;
  name: string;
  whatsapp: string;
}): Promise<RegisterSessionActionResult> {
  const session_id = String(input.session_id || '').trim();
  const name = String(input.name || '').trim();
  const whatsappRaw = String(input.whatsapp || '').trim();
  const whatsapp = canonicalizePhoneWa(whatsappRaw) || whatsappRaw;

  if (!session_id || !name || !whatsapp) {
    return { ok: false, error: ar.errors.session.inputRequired };
  }

  if (!supabaseClient) {
    const mock: SessionRegistration = {
      id: crypto.randomUUID(),
      session_id,
      name,
      whatsapp,
      created_at: new Date().toISOString(),
    };
    return { ok: true, data: mock, demo: true };
  }

  const { data: sessionRow, error: sessionErr } = await supabaseClient
    .from('sessions')
    .select('id, title, spots')
    .eq('id', session_id)
    .maybeSingle();

  if (sessionErr) {
    return {
      ok: false,
      error: `${ar.errors.trip.dbConnection} (${ar.errors.session.readSessionFailed})`,
    };
  }

  if (!sessionRow?.id) {
    return { ok: false, error: ar.errors.session.sessionNotFound };
  }

  const title = String(sessionRow.title ?? '').trim() || 'جلسة';
  const spotsBefore = Math.max(0, Number(sessionRow.spots ?? 0));

  if (spotsBefore < 1) {
    return { ok: false, error: ar.errors.session.sessionFull };
  }

  const { data: reg, error: regErr } = await supabaseClient
    .from('session_registrations')
    .insert({
      session_id,
      name,
      whatsapp,
    })
    .select()
    .single();

  if (regErr || !reg) {
    return {
      ok: false,
      error: toArabicSessionError(regErr?.message || '', regErr?.code),
    };
  }

  const { data: updated, error: upErr } = await supabaseClient
    .from('sessions')
    .update({ spots: spotsBefore - 1 })
    .eq('id', session_id)
    .eq('spots', spotsBefore)
    .select('spots')
    .maybeSingle();

  if (upErr || updated == null) {
    await supabaseClient.from('session_registrations').delete().match({ session_id, whatsapp });
    return {
      ok: false,
      error: ar.errors.session.raceNoSeat,
    };
  }

  const spotsRemaining = Math.max(0, Number(updated.spots ?? 0));

  const crmResult = await insertCrmInterestProfile({
    name,
    whatsapp,
    session_id,
    sessionTitle: title,
  });

  if (!crmResult.ok) {
    // Session seat is already reserved — do not roll it back for a CRM profile glitch.
    console.warn('[registerSession] session saved; CRM profile soft-failed:', crmResult.message);
    void tripLeadInsertUserMessage(crmResult.message);
  } else if (crmResult.leadId) {
    // Await intake provisioning (no auto WhatsApp — manual send only)
    try {
      const automation = await runRegistrationAutomationPipeline({
        leadId: crmResult.leadId,
        fullName: name,
        phoneWa: whatsapp,
        source: 'session_registration',
        origin:
          String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
          'https://wanderloom-travel.vercel.app',
      });
      if (automation.errors.length) {
        console.warn('[registerSession] automation warnings:', automation.errors);
      }
    } catch (automationErr) {
      console.warn('[registerSession] automation failed:', automationErr);
    }
  }

  revalidatePath('/');
  revalidatePath('/sessions');
  revalidatePath('/portal/sessions');
  revalidatePath('/crm/sessions');
  revalidatePath('/crm/radar');

  return {
    ok: true,
    data: reg as SessionRegistration,
    spotsRemaining,
  };
}
