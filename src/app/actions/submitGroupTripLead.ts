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

export async function submitGroupTripLead(input: {
  full_name: string;
  phone_wa: string;
  group_size: number;
  /** يُخزَّن في عمود `source` — اسم رحلة المجموعة المعروضة */
  trip_label: string;
}): Promise<GroupTripLeadState> {
  const full_name = s(input.full_name);
  const phone_wa = s(input.phone_wa);
  const trip_label = s(input.trip_label);
  const group_size = Math.min(199, Math.max(1, Math.floor(Number(input.group_size) || 0)));

  if (!full_name || !phone_wa) {
    return { ok: false, error: ar.errors.trip.namePhone };
  }

  if (!trip_label) {
    return { ok: false, error: ar.errors.groupTrip.missingPackage };
  }

  if (!Number.isFinite(group_size) || group_size < 1) {
    return { ok: false, error: ar.errors.groupTrip.invalidSize };
  }

  if (!supabaseClient) {
    return { ok: false, error: ar.errors.trip.dbNotConfigured };
  }

  const destination_dream = `تسجيل مجموعة — ${trip_label}`;
  const dream_closing = `عدد أفراد المجموعة المذكور: ${group_size}`;

  const row: Record<string, unknown> = {
    full_name,
    phone_wa,
    source: trip_label,
    group_size,
    destination_dream,
    dream_closing,
    travel_days: null,
    travel_start_date: null,
    travelers_count: group_size,
    trip_style: null,
    budget_range: null,
    interests_notes: `طلب مجموعة · ${trip_label}`,
    trip_form: {
      lead_type: 'group_trip',
      trip_label,
      group_size,
    },
    email: null,
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
