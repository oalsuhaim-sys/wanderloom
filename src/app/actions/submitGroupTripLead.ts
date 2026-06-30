'use server';

import { revalidatePath } from 'next/cache';

import { tripLeadInsertUserMessage } from '@/lib/i18n/db-error-message';
import { ar } from '@/messages/ar';
import { supabaseClient } from '@/lib/supabaseClient';

export type GroupTripLeadState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitGroupTripLead(input: {
  full_name: string;
  phone_wa: string;
  email: string;
  age: number;
  /** يُخزَّن في عمود `source` — اسم رحلة المجموعة المعروضة */
  trip_label: string;
}): Promise<GroupTripLeadState> {
  const full_name = s(input.full_name);
  const phone_wa = s(input.phone_wa);
  const email = s(input.email);
  const trip_label = s(input.trip_label);
  const age = Math.floor(Number(input.age));

  if (!full_name || !phone_wa) {
    return { ok: false, error: ar.errors.trip.namePhone };
  }

  if (!email) {
    return { ok: false, error: ar.errors.groupTrip.emailRequired };
  }

  if (!isValidEmail(email)) {
    return { ok: false, error: ar.errors.groupTrip.invalidEmail };
  }

  if (!Number.isFinite(age) || age < 1 || age > 120) {
    return { ok: false, error: ar.errors.groupTrip.invalidAge };
  }

  if (!trip_label) {
    return { ok: false, error: ar.errors.groupTrip.missingPackage };
  }

  if (!supabaseClient) {
    return { ok: false, error: ar.errors.trip.dbNotConfigured };
  }

  const destination_dream = `حجز مقعد — ${trip_label}`;
  const dream_closing = `مقعد واحد · العمر: ${age}`;
  const interests_notes = `حجز مقعد في رحلة جماعية · ${trip_label} · العمر: ${age}`;

  const row: Record<string, unknown> = {
    full_name,
    phone_wa,
    email,
    source: trip_label,
    group_size: 1,
    destination_dream,
    dream_closing,
    travel_days: null,
    travel_start_date: null,
    travelers_count: 1,
    trip_style: null,
    budget_range: null,
    interests_notes,
    trip_form: {
      lead_type: 'group_trip_seat',
      trip_label,
      seats: 1,
      email,
      age,
    },
    city: null,
    travel_window: null,
    status: 'new',
  };

  const { error } = await supabaseClient.from('customers').insert(row as never);

  if (error) {
    const missingGroupSize = error.message?.includes('group_size');
    const hint = missingGroupSize
      ? ' نفّذ supabase/sql/customers_group_size.sql لإضافة عمود group_size.'
      : '';
    const { user } = tripLeadInsertUserMessage(error.message || '');
    return { ok: false, error: `${user}${hint}` };
  }

  revalidatePath('/');
  revalidatePath('/sessions');

  return { ok: true, message: ar.success.groupTripRegistered };
}
