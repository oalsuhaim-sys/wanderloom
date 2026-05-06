'use server';

import { revalidatePath } from 'next/cache';

import { tripLeadInsertUserMessage } from '@/lib/i18n/db-error-message';
import { ar } from '@/messages/ar';
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

/**
 * تسجيل عميل في جلسة: إدراج في session_registrations، إنقاص spots بمقدار 1، وإنشاء Lead في customers.
 */
export async function registerSessionAction(input: {
  session_id: string;
  name: string;
  whatsapp: string;
}): Promise<RegisterSessionActionResult> {
  const session_id = String(input.session_id || '').trim();
  const name = String(input.name || '').trim();
  const whatsapp = String(input.whatsapp || '').trim();

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
  const source = `تسجيل من جلسة: ${title}`;
  const destination_dream = `اهتمام بالجلسة: ${title}`;

  const customerRow: Record<string, unknown> = {
    full_name: name,
    phone_wa: whatsapp,
    source,
    destination_dream,
    dream_closing: null,
    travel_days: null,
    travel_start_date: null,
    travelers_count: 1,
    trip_style: null,
    budget_range: null,
    interests_notes: null,
    trip_form: {
      lead_source: 'session_registration',
      session_id,
      session_title: title,
    },
    email: null,
    city: null,
    travel_window: null,
    status: 'new',
  };

  const { error: custErr } = await supabaseClient.from('customers').insert(customerRow as never);

  if (custErr) {
    await supabaseClient.from('sessions').update({ spots: spotsBefore }).eq('id', session_id).eq('spots', spotsBefore - 1);
    await supabaseClient.from('session_registrations').delete().match({ session_id, whatsapp });
    const { user } = tripLeadInsertUserMessage(custErr.message || '');
    return {
      ok: false,
      error: `${ar.errors.session.customerSaveFailed} ${user}`,
    };
  }

  revalidatePath('/');
  revalidatePath('/sessions');
  revalidatePath('/portal/sessions');
  revalidatePath('/crm/sessions');

  return {
    ok: true,
    data: reg as SessionRegistration,
    spotsRemaining,
  };
}
