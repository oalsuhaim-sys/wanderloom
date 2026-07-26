import type { SupabaseClient } from '@supabase/supabase-js';

import { TRIP_DESTINATIONS, type TripCountryDef } from '@/lib/trip-destination-data';
import type { PlaceBankRow } from '@/types/place';

/** سقف جلب بنك الأماكن — يتجاوز حد PostgREST الافتراضي (1000) عبر التجزئة */
export const PLACES_BANK_FETCH_LIMIT = 10_000;

/** حجم صفحة العرض في المكوّنات ذات الترقيم (PlacesBankExplorer وغيرها) */
export const PLACES_BANK_PAGE_SIZE = 200;

/** جدول Supabase الوحيد لبنك الأماكن — لا mock ولا marketing_content */
export const PLACES_BANK_TABLE = 'places';

export type PlacesBankFetchFilters = {
  search?: string;
  category?: string;
};

export type PlacesBankViewFilters = {
  countries?: string[];
  /** فلتر المدينة اليدوي من القائمة المنسدلة — لا يُربط تلقائياً بمدن المسار */
  cityFilter?: string;
  search?: string;
  category?: string;
};

/** تسميات الفئات — رموز DB القصيرة (r/c/l/f/o/d) + تراثية */
export const PLACES_BANK_CATEGORIES: Record<string, string> = {
  r: 'مطعم 🍽️',
  c: 'مقهى ☕',
  l: 'لاونج / معلم 🏛️',
  f: 'ترفيه عائلي 🎡',
  o: 'طبيعة / أخرى 🌳',
  d: 'وجهة رئيسية 📍',
  // legacy codes still present in older rows
  s: 'تسوق 🛍️',
  h: 'فندق 🏨',
};

export const PLACE_CATEGORY_OPTIONS = [
  { id: 'r', label: 'مطعم 🍽️' },
  { id: 'c', label: 'مقهى ☕' },
  { id: 'l', label: 'لاونج / معلم 🏛️' },
  { id: 'f', label: 'ترفيه عائلي 🎡' },
  { id: 'o', label: 'طبيعة / أخرى 🌳' },
  { id: 'd', label: 'وجهة رئيسية 📍' },
] as const;

/** أسماء إنجليزية / DB شائعة لكل دولة في TRIP_DESTINATIONS */
const COUNTRY_ENGLISH_ALIASES: Record<string, string[]> = {
  japan: ['Japan', 'JP'],
  korea: ['South Korea', 'Korea', 'KR'],
  china: ['China', 'CN'],
  canada: ['Canada', 'CA'],
  south_africa: ['South Africa', 'ZA'],
  germany: ['Germany', 'DE', 'Deutschland'],
  spain: ['Spain', 'España', 'Espana', 'Espanya', 'ESP'],
  italy: ['Italy', 'Italia', 'IT'],
  france: ['France', 'FR'],
  uk: ['United Kingdom', 'UK', 'Britain', 'Great Britain', 'GB'],
  usa: ['United States', 'USA', 'US', 'America'],
  portugal: ['Portugal', 'PT'],
  belgium: ['Belgium', 'BE'],
  netherlands: ['Netherlands', 'Holland', 'NL'],
  czech: ['Czech Republic', 'Czechia', 'CZ'],
  poland: ['Poland', 'PL'],
  austria: ['Austria', 'AT'],
  sweden: ['Sweden', 'SE'],
  russia: ['Russia', 'RU'],
  hungary: ['Hungary', 'HU'],
  switzerland: ['Switzerland', 'CH'],
};

function normalizeGeoToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u0640]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function arabicHamzaVariants(label: string): string[] {
  const base = label.trim();
  if (!base) return [];
  return [
    base,
    base.replace(/إ/g, 'ا').replace(/أ/g, 'ا').replace(/آ/g, 'ا'),
    base.replace(/ا/g, 'إ'),
    base.replace(/اس/g, 'إس').replace(/إس/g, 'اس'),
  ];
}

function findTripCountry(input: string): TripCountryDef | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return TRIP_DESTINATIONS.find(
    (c) => c.id === trimmed || c.labelAr === trimmed || normalizeGeoToken(c.labelAr) === normalizeGeoToken(trimmed),
  );
}

/** يوسّع تسمية الدولة (عربي/إنجليزي) إلى كل الصيغ المحتملة في DB */
export function expandCountryMatchTerms(countryLabels: string[]): string[] {
  const terms = new Set<string>();
  for (const raw of countryLabels) {
    const label = raw.trim();
    if (!label) continue;
    terms.add(label);
    for (const variant of arabicHamzaVariants(label)) terms.add(variant);

    const def = findTripCountry(label);
    if (def) {
      terms.add(def.labelAr);
      terms.add(def.id);
      for (const variant of arabicHamzaVariants(def.labelAr)) terms.add(variant);
      for (const en of COUNTRY_ENGLISH_ALIASES[def.id] ?? []) terms.add(en);
    }
  }
  return [...terms].filter(Boolean);
}

export function placeRowMatchesCountryTerms(
  place: { country?: string | null },
  terms: string[],
): boolean {
  if (!terms.length) return true;
  const placeCountry = normalizeGeoToken(String(place.country ?? ''));
  if (!placeCountry) return false;
  return terms.some((term) => {
    const needle = normalizeGeoToken(term);
    if (!needle) return false;
    return (
      placeCountry === needle ||
      placeCountry.includes(needle) ||
      needle.includes(placeCountry)
    );
  });
}

export function placeRowMatchesCityFilter(
  place: { city?: string | null },
  cityFilter: string,
): boolean {
  const needle = normalizeGeoToken(cityFilter);
  if (!needle) return true;
  const placeCity = normalizeGeoToken(String(place.city ?? ''));
  if (!placeCity) return false;
  return placeCity === needle || placeCity.includes(needle) || needle.includes(placeCity);
}

/** فلترة العرض على العميل — دعم إسبانيا/اسبانia/Spain وغيرها */
export function filterPlacesBankInventory<T extends PlaceBankRow>(
  places: T[],
  filters: PlacesBankViewFilters,
): T[] {
  const countries = (filters.countries ?? []).map((c) => c.trim()).filter(Boolean);
  const countryTerms = expandCountryMatchTerms(countries);
  const search = filters.search?.trim().toLowerCase() ?? '';
  const category = filters.category?.trim() ?? '';
  const cityFilter = filters.cityFilter?.trim() ?? '';

  return places.filter((place) => {
    if (countryTerms.length && !placeRowMatchesCountryTerms(place, countryTerms)) return false;
    if (cityFilter && !placeRowMatchesCityFilter(place, cityFilter)) return false;
    if (category && String(place.category ?? '') !== category) return false;
    if (search) {
      const name = String(place.name ?? '').toLowerCase();
      const city = String(place.city ?? '').toLowerCase();
      if (!name.includes(search) && !city.includes(search)) return false;
    }
    return true;
  });
}

/**
 * يجلب المخزون الكامل من جدول `places` (حتى 10,000) — بدون limit(12) وبدون mock.
 * فلاتر الدولة/المدينة تُطبَّق على العميل عبر filterPlacesBankInventory.
 */
export async function fetchAllPlacesBank(
  client: SupabaseClient,
  filters?: PlacesBankFetchFilters,
): Promise<PlaceBankRow[]> {
  const all: PlaceBankRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < PLACES_BANK_FETCH_LIMIT; offset += pageSize) {
    let q = client.from(PLACES_BANK_TABLE).select('*').order('name', { ascending: true });
    if (filters?.search?.trim()) q = q.ilike('name', `%${filters.search.trim()}%`);
    if (filters?.category?.trim()) q = q.eq('category', filters.category.trim());

    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as PlaceBankRow[]));
    if (data.length < pageSize) break;
  }

  return all.slice(0, PLACES_BANK_FETCH_LIMIT);
}

export function placeBankCategoryLabel(code: string): string {
  return PLACES_BANK_CATEGORIES[code] ?? PLACES_BANK_CATEGORIES.o ?? '🧭 أخرى';
}

export function placeBankMapsSearchUrl(place: Pick<PlaceBankRow, 'name' | 'city' | 'country'>): string {
  const q = [place.name, place.city, place.country].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

export function placeBankGeocodeQuery(place: Pick<PlaceBankRow, 'name' | 'city' | 'country'>): string {
  return [place.name, place.city, place.country].filter(Boolean).join(', ');
}
