'use server';

import { revalidatePath } from 'next/cache';

import { tripLeadInsertUserMessage } from '@/lib/i18n/db-error-message';
import { labelForCityComposite, labelForCountryId } from '@/lib/trip-destination-data';
import { ar } from '@/messages/ar';
import { supabaseClient } from '@/lib/supabaseClient';

export type CustomerLeadState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

function all(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

export async function submitCustomerLead(formData: FormData): Promise<CustomerLeadState> {
  const full_name = s(formData.get('full_name'));
  const phone_wa = s(formData.get('phone_wa'));
  const source = s(formData.get('source')) || null;
  const dream_feeling = s(formData.get('dream_feeling'));

  const destCountries = all(formData, 'dest_countries');
  const cities = all(formData, 'cities');
  const travel_start_date = s(formData.get('travel_start_date')) || null;
  const travel_days_raw = s(formData.get('travel_days'));
  const travelers_count_raw = s(formData.get('travelers_count'));
  const budget_range = s(formData.get('budget_range')) || null;

  const interests = all(formData, 'interests');

  const pace = s(formData.get('pace')) || null;
  const walking = s(formData.get('walking')) || null;
  const day_start = s(formData.get('day_start')) || null;

  const food_prefs = all(formData, 'food_prefs');
  const lodging_prefs = all(formData, 'lodging_prefs');

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

  const trip_form = {
    section1_contact: { full_name, phone_wa, source },
    section2_destination: {
      dest_countries: destCountries,
      cities: citiesNormalized,
      travel_start_date,
      travel_days,
      travelers_count,
      budget_range,
    },
    section3_interests: {
      interests,
      visited_before: visitedBefore,
    },
    section4_style: { pace, walking, day_start },
    section5_food_lodging: { food_prefs, lodging_prefs },
    section6_dream: { dream_feeling },
  };

  const destLabel = destCountries.map((c) => labelForCountryId(c)).join(' · ');
  const cityLabel = citiesNormalized.map((k) => labelForCityComposite(k)).join('، ');
  const destination_dream = `${destLabel} — ${cityLabel} — ${travelers_count} مسافرًا — ${travel_days} يومًا${budget_range ? ` — ميزانية: ${budget_range}` : ''}`;

  const visitSummary =
    Object.keys(visitedBefore).length > 0
      ? `زيارات سابقة: ${Object.entries(visitedBefore)
          .map(([id, ans]) => `${labelForCountryId(id)} (${ans === 'yes' ? 'نعم' : 'لا'})`)
          .join('، ')}`
      : null;

  const interests_notes = [
    interests.length ? `اهتمامات: ${interests.join('، ')}` : null,
    visitSummary,
    food_prefs.length ? `طعام: ${food_prefs.join('، ')}` : null,
    lodging_prefs.length ? `إقامة: ${lodging_prefs.join('، ')}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  if (!supabaseClient) {
    return {
      ok: false,
      error: ar.errors.trip.dbNotConfigured,
    };
  }

  const row: Record<string, unknown> = {
    full_name,
    phone_wa,
    source,
    destination_dream,
    dream_closing: dream_feeling,
    travel_days,
    travel_start_date: travel_start_date || null,
    travelers_count,
    trip_style: [pace, walking, day_start].filter(Boolean).join(' · ') || null,
    budget_range: budget_range || null,
    interests_notes: interests_notes || null,
    trip_form,
    email: null,
    city: null,
    travel_window: travel_start_date || null,
    status: 'new',
  };

  const { error } = await supabaseClient.from('customers').insert(row as never);

  if (error) {
    const missingCol =
      error.message?.includes('trip_form') ||
      error.message?.includes('dream_closing') ||
      error.message?.includes('travel_days') ||
      error.message?.includes('travel_start_date');

    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      return { ok: false, error: ar.errors.trip.dbTableMissing };
    }

    const { user } = tripLeadInsertUserMessage(error.message || '');
    const columnsHint = missingCol ? ar.errors.trip.dbColumnsHint : '';
    return {
      ok: false,
      error: `${user}${columnsHint}`,
    };
  }

  revalidatePath('/');
  revalidatePath('/sessions');
  return {
    ok: true,
    message: ar.success.tripLeadSent,
  };
}
