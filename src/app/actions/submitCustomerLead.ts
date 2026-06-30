'use server';

import { revalidatePath } from 'next/cache';

import { labelForCityComposite, labelForCountryId } from '@/lib/trip-destination-data';
import { normalizeAffiliateRef } from '@/lib/referral-url';
import { ar } from '@/messages/ar';
import { createServerSupabase } from '@/lib/supabase/server';

export type CustomerLeadState = {
  ok: boolean;
  error?: string;
  message?: string;
};

type SupabaseInsertError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

type LeadsInsertRow = {
  full_name: string;
  email: string | null;
  phone_wa: string;
  age: number | null;
  destinations: string[];
  travel_date: string | null;
  travel_days: number;
  travelers_count: number;
  budget: string | null;
  interests: string[];
  travel_style: string | null;
  daily_pace: string | null;
  walking_readiness: string | null;
  day_start_time: string | null;
  food_preferences: string[];
  accommodation_type: string[];
  final_thoughts: string;
  form_type: 'trip_log' | 'contact';
  status: 'new';
  referral_code?: string | null;
};

function formatSupabaseInsertError(error: SupabaseInsertError): string {
  const message = error.message?.trim() || 'Unknown database error';
  const details = error.details?.trim();
  const hint = error.hint?.trim();
  const code = error.code?.trim();

  let text = `عذراً، تعذر الحفظ: ${message}`;
  if (details) text += ` | Details: ${details}`;
  if (hint) text += ` | Hint: ${hint}`;
  if (code) text += ` | Code: ${code}`;
  return text;
}

function formatThrownError(error: unknown): string {
  if (error instanceof Error) {
    return `عذراً، تعذر الحفظ: ${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `عذراً، تعذر الحفظ: ${error.trim()}`;
  }
  try {
    return `عذراً، تعذر الحفظ: ${JSON.stringify(error)}`;
  } catch {
    return ar.errors.trip.dbSaveFailed;
  }
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

function all(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

function mergeOtherPref(values: string[], otherText: string): string[] {
  const withoutOther = values.filter((v) => v !== 'other');
  const detail = otherText.trim();
  if (values.includes('other') && detail) {
    return [...withoutOther, `أخرى: ${detail}`];
  }
  if (values.includes('other')) {
    return [...withoutOther, 'أخرى'];
  }
  return withoutOther;
}

function buildFinalThoughts(
  dreamFeeling: string,
  visitedBefore: Record<string, 'yes' | 'no'>,
): string {
  const lines = [dreamFeeling];

  const visitLines = Object.entries(visitedBefore).map(
    ([countryId, answer]) =>
      `${labelForCountryId(countryId)}: ${answer === 'yes' ? 'سبق الزيارة' : 'لم يسبق الزيارة'}`,
  );
  if (visitLines.length > 0) {
    lines.push(`زيارات سابقة:\n${visitLines.join('\n')}`);
  }

  return lines.join('\n\n');
}

export async function submitCustomerLead(formData: FormData): Promise<CustomerLeadState> {
  try {
    const full_name = s(formData.get('full_name'));
    const phone_wa = s(formData.get('phone_wa'));
    const source = s(formData.get('source')) || null;
    const referral_code = normalizeAffiliateRef(s(formData.get('referral_code')));
    const dream_feeling = s(formData.get('dream_feeling'));

    const destCountries = all(formData, 'dest_countries');
    const cities = all(formData, 'cities');
    const travel_date = s(formData.get('travel_start_date')) || null;
    const travel_days_raw = s(formData.get('travel_days'));
    const travelers_count_raw = s(formData.get('travelers_count'));
    const budget = s(formData.get('budget_range')) || null;

    const interests = mergeOtherPref(all(formData, 'interests'), s(formData.get('interests_other')));
    const daily_pace = s(formData.get('pace')) || null;
    const walking_readiness = s(formData.get('walking')) || null;
    const day_start_time = s(formData.get('day_start')) || null;
    const food_preferences = mergeOtherPref(
      all(formData, 'food_prefs'),
      s(formData.get('food_prefs_other')),
    );
    const accommodation_type = mergeOtherPref(
      all(formData, 'lodging_prefs'),
      s(formData.get('lodging_prefs_other')),
    );

    if (!full_name || !phone_wa) {
      return { ok: false, error: ar.errors.trip.namePhone };
    }

    if (!dream_feeling) {
      return { ok: false, error: ar.errors.trip.dreamRequired };
    }

    if (destCountries.length === 0) {
      return { ok: false, error: ar.errors.trip.countryRequired };
    }

    const citiesNormalized = cities.filter((row) => {
      const i = row.indexOf(':');
      if (i < 1) return false;
      return destCountries.includes(row.slice(0, i));
    });

    if (citiesNormalized.length === 0) {
      return { ok: false, error: ar.errors.trip.cityRequired };
    }

    const visitedBefore: Record<string, 'yes' | 'no'> = {};
    for (const cid of destCountries) {
      const raw = s(formData.get(`visited_before_${cid}`));
      if (raw !== 'yes' && raw !== 'no') {
        return {
          ok: false,
          error: ar.errors.trip.visitNotAnswered.replace('{country}', labelForCountryId(cid)),
        };
      }
      visitedBefore[cid] = raw;
    }

    const travel_days = Math.min(90, Math.max(1, parseInt(travel_days_raw || '7', 10) || 7));
    const travelers_count = Math.min(40, Math.max(1, parseInt(travelers_count_raw || '2', 10) || 2));

    const destinations = citiesNormalized.map((composite) => labelForCityComposite(composite));

    const row: LeadsInsertRow = {
      full_name,
      email: null,
      phone_wa,
      age: null,
      destinations,
      travel_date,
      travel_days,
      travelers_count,
      budget,
      interests,
      travel_style: source,
      daily_pace,
      walking_readiness,
      day_start_time,
      food_preferences,
      accommodation_type,
      final_thoughts: buildFinalThoughts(dream_feeling, visitedBefore),
      form_type: 'trip_log',
      status: 'new',
    };

    if (referral_code) {
      row.referral_code = referral_code;
    }

    const supabase = createServerSupabase();
    let { error } = await supabase.from('leads').insert(row as never);

    if (error && referral_code && (error.message ?? '').toLowerCase().includes('referral_code')) {
      const { referral_code: _drop, ...withoutRef } = row;
      ({ error } = await supabase.from('leads').insert(withoutRef as never));
    }

    if (error) {
      console.error('Supabase Error:', error);
      return {
        ok: false,
        error: formatSupabaseInsertError(error),
      };
    }

    revalidatePath('/');
    revalidatePath('/sessions');
    return {
      ok: true,
      message: ar.success.tripLeadSent,
    };
  } catch (error) {
    console.error('Supabase Error:', error);
    return {
      ok: false,
      error: formatThrownError(error),
    };
  }
}
