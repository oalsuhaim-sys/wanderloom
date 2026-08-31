import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { TripCountryDef } from '@/lib/trip-destination-data';
import { TRIP_DESTINATIONS } from '@/lib/trip-destination-data';

export type CountryOption = {
  id: string;
  name: string;
  flag: string;
};

/** قائمة ثابتة احتياطية — تُستخدم عند غياب جدول countries أو فشل الجلب */
export const DEFAULT_COUNTRIES: CountryOption[] = [
  { id: 'indonesia', name: 'إندونيسيا', flag: '🇮🇩' },
  { id: 'japan', name: 'اليابان', flag: '🇯🇵' },
  { id: 'south_korea', name: 'كوريا الجنوبية', flag: '🇰🇷' },
  { id: 'china', name: 'الصين', flag: '🇨🇳' },
  { id: 'canada', name: 'كندا', flag: '🇨🇦' },
  { id: 'south_africa', name: 'جنوب أفريقيا', flag: '🇿🇦' },
  { id: 'germany', name: 'ألمانيا', flag: '🇩🇪' },
  { id: 'spain', name: 'إسبانيا', flag: '🇪🇸' },
  { id: 'italy', name: 'إيطاليا', flag: '🇮🇹' },
  { id: 'france', name: 'فرنسا', flag: '🇫🇷' },
  { id: 'uk', name: 'بريطانيا', flag: '🇬🇧' },
  { id: 'usa', name: 'أمريكا', flag: '🇺🇸' },
  { id: 'portugal', name: 'البرتغال', flag: '🇵🇹' },
  { id: 'belgium', name: 'بلجيكا', flag: '🇧🇪' },
  { id: 'netherlands', name: 'هولندا', flag: '🇳🇱' },
  { id: 'czech', name: 'التشيك', flag: '🇨🇿' },
  { id: 'poland', name: 'بولندا', flag: '🇵🇱' },
  { id: 'austria', name: 'النمسا', flag: '🇦🇹' },
  { id: 'sweden', name: 'السويد', flag: '🇸🇪' },
  { id: 'russia', name: 'روسيا', flag: '🇷🇺' },
  { id: 'hungary', name: 'المجر', flag: '🇭🇺' },
  { id: 'switzerland', name: 'سويسرا', flag: '🇨🇭' },
];

type CountriesRow = {
  id?: string | null;
  name_ar?: string | null;
  flag?: string | null;
  sort_order?: number | null;
};

function slugifyCountryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0600-\u06FF-]/g, '');
}

export function normalizeCountriesFromDb(rows: unknown): CountryOption[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const out: CountryOption[] = [];
  const seen = new Set<string>();

  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as CountriesRow;
    const name = String(row.name_ar ?? '').trim();
    if (!name) continue;

    const id = String(row.id ?? '').trim() || slugifyCountryId(name);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      name,
      flag: String(row.flag ?? '').trim(),
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export function mergeCountryLists(
  primary: CountryOption[],
  fallback: CountryOption[] = DEFAULT_COUNTRIES,
): CountryOption[] {
  const byId = new Map<string, CountryOption>();
  for (const country of fallback) byId.set(country.id, country);
  for (const country of primary) byId.set(country.id, country);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** يدمج الدول الديناميكية مع تعريفات المدن الثابتة في TRIP_DESTINATIONS */
export function mergeTripDestinationsWithCountries(
  countries: CountryOption[],
): TripCountryDef[] {
  const byId = new Map<string, TripCountryDef>(
    TRIP_DESTINATIONS.map((country) => [country.id, { ...country, cities: [...country.cities] }]),
  );

  for (const country of countries) {
    const existing = byId.get(country.id);
    if (existing) {
      byId.set(country.id, {
        ...existing,
        labelAr: country.name || existing.labelAr,
      });
      continue;
    }
    byId.set(country.id, {
      id: country.id,
      labelAr: country.name,
      cities: [],
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.labelAr.localeCompare(b.labelAr, 'ar'),
  );
}

export function countryDisplayLabel(country: CountryOption): string {
  return country.flag ? `${country.flag} ${country.name}` : country.name;
}

export function countryStoredFlagValue(country: CountryOption): string {
  return countryDisplayLabel(country);
}

export async function fetchActiveCountries(
  client: SupabaseClient | null = supabase,
): Promise<CountryOption[]> {
  if (!client) return [...DEFAULT_COUNTRIES];

  const attempts = [
    'id, name_ar, flag, sort_order',
    'id, name_ar, flag',
    'name_ar, flag',
  ] as const;

  for (const select of attempts) {
    const { data, error } = await client
      .from('countries')
      .select(select)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) continue;

    const normalized = normalizeCountriesFromDb(data);
    if (normalized.length > 0) {
      return mergeCountryLists(normalized);
    }
  }

  return [...DEFAULT_COUNTRIES];
}
