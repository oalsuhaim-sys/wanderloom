import type { SupabaseClient } from '@supabase/supabase-js';

import { TRIP_DESTINATIONS, type TripCountryDef } from '@/lib/trip-destination-data';
import { isPlacesCoordinateSchemaError } from '@/lib/places-proximity';
import type { PlaceBankRow } from '@/types/place';

/** سقف جلب بنك الأماكن — يتجاوز حد PostgREST الافتراضي (1000) عبر التجزئة */
export const PLACES_BANK_FETCH_LIMIT = 10_000;

/** حجم صفحة العرض في المكوّنات ذات الترقيم (PlacesBankExplorer وغيرها) */
export const PLACES_BANK_PAGE_SIZE = 200;

/** جدول Supabase الوحيد لبنك الأماكن — لا mock ولا marketing_content */
export const PLACES_BANK_TABLE = 'places';

/** أعمدة قائمة البنك — لا تستخدم select('*') في واجهات التصفح */
export const PLACES_BANK_LIST_SELECT =
  'id, name, country, city, branch_name, map_url, maps_url, category, image_url, sub_tag, latitude, longitude';
export const PLACES_BANK_LIST_SELECT_MINIMAL =
  'id, name, country, city, category, image_url, sub_tag';

/** Progressive selects when optional columns are missing from schema */
const PLACES_BANK_SELECT_FALLBACKS = [
  PLACES_BANK_LIST_SELECT,
  'id, name, country, city, branch_name, map_url, category, image_url, sub_tag, latitude, longitude',
  'id, name, country, city, category, image_url, sub_tag, latitude, longitude',
  PLACES_BANK_LIST_SELECT_MINIMAL,
  'id, name, country, city, category, image_url',
  'id, name, country, city, category',
  'id, name, country, city',
  'id, name',
] as const;

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

export type PlacesBankPageParams = PlacesBankViewFilters & {
  page?: number;
  pageSize?: number;
};

export type PlacesBankPageResult = {
  rows: PlaceBankRow[];
  total: number;
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
  indonesia: ['Indonesia', 'ID'],
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

function isPlacesSelectSchemaError(message: string): boolean {
  return (
    isPlacesCoordinateSchemaError(message) ||
    /column|schema cache|does not exist/i.test(message)
  );
}

/**
 * يجلب المخزون الكامل من جدول `places` (حتى 10,000) — للاستخدامات المجمّعة فقط
 * (مثل محرك القرب). لواجهات التصفح استخدم fetchPlacesBankPage.
 */
export async function fetchAllPlacesBank(
  client: SupabaseClient,
  filters?: PlacesBankFetchFilters,
): Promise<PlaceBankRow[]> {
  const all: PlaceBankRow[] = [];
  const pageSize = 1000;
  let columns: string = PLACES_BANK_LIST_SELECT;
  let selectIdx = 0;

  for (let offset = 0; offset < PLACES_BANK_FETCH_LIMIT; offset += pageSize) {
    let q = client
      .from(PLACES_BANK_TABLE)
      .select(columns)
      .order('name', { ascending: true });
    if (filters?.search?.trim()) q = q.ilike('name', `%${filters.search.trim()}%`);
    if (filters?.category?.trim()) q = q.eq('category', filters.category.trim());

    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (
      error &&
      isPlacesSelectSchemaError(error.message ?? '') &&
      selectIdx < PLACES_BANK_SELECT_FALLBACKS.length - 1
    ) {
      selectIdx += 1;
      columns = PLACES_BANK_SELECT_FALLBACKS[selectIdx];
      console.warn('[fetchAllPlacesBank] select fallback →', columns, error.message);
      offset -= pageSize;
      continue;
    }
    if (error) {
      console.error('[fetchAllPlacesBank] Supabase error:', error.message);
      throw error;
    }
    if (!data?.length) break;
    all.push(...((data ?? []) as unknown as PlaceBankRow[]));
    if (data.length < pageSize) break;
  }

  return all.slice(0, PLACES_BANK_FETCH_LIMIT);
}

function applyPlacesBankFilters(
   
  q: any,
  filters: PlacesBankViewFilters,
  opts?: { skipCountry?: boolean },
) {
  const search = filters.search?.trim();
  const category = filters.category?.trim();
  const cityFilter = filters.cityFilter?.trim();
  const countries = (filters.countries ?? []).map((c) => c.trim()).filter(Boolean);
  const countryTerms = expandCountryMatchTerms(countries);

  if (search) {
    const escaped = search.replace(/[%_,.()]/g, ' ').trim();
    if (escaped) {
      q = q.or(`name.ilike.%${escaped}%,city.ilike.%${escaped}%`);
    }
  }
  if (category) q = q.eq('category', category);
  if (cityFilter) {
    const cityEscaped = cityFilter.replace(/[%_,.()]/g, ' ').trim();
    if (cityEscaped) q = q.ilike('city', `%${cityEscaped}%`);
  }
  /**
   * Country: use `.in()` with expanded aliases.
   * Do NOT call a second `.or()` here — it overwrites the search `.or()` in PostgREST.
   * If `.in` matches nothing, fetchPlacesBankPage retries with skipCountry.
   */
  if (!opts?.skipCountry && countryTerms.length) {
    const unique = [...new Set(countryTerms)].slice(0, 40);
    q = q.in('country', unique);
  }
  return q;
}

/**
 * صفحة واحدةحد من بنك الأماكن مع أعمدة ضيقة + count — للاستخدام في Timeline / Modal / Explorer.
 */
export async function fetchPlacesBankPage(
  client: SupabaseClient,
  params: PlacesBankPageParams = {},
): Promise<PlacesBankPageResult> {
  const page = Math.max(0, params.page ?? 0);
  const pageSize = Math.max(1, Math.min(params.pageSize ?? PLACES_BANK_PAGE_SIZE, 500));
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const countries = (params.countries ?? []).map((c) => c.trim()).filter(Boolean);

  const run = async (columns: string, skipCountry = false) => {
    let q = client
      .from(PLACES_BANK_TABLE)
      .select(columns, { count: 'exact' })
      .order('name', { ascending: true });
    q = applyPlacesBankFilters(q, params, { skipCountry });
    return q.range(from, to);
  };

  let data: unknown[] | null = null;
  let count: number | null = null;
  let error: { message?: string } | null = null;
  let usedColumns: string = PLACES_BANK_SELECT_FALLBACKS[0];

  for (let i = 0; i < PLACES_BANK_SELECT_FALLBACKS.length; i++) {
    usedColumns = PLACES_BANK_SELECT_FALLBACKS[i];
    const result = await run(usedColumns, false);
    data = result.data as unknown[] | null;
    count = result.count;
    error = result.error;

    if (!error) break;

    console.error('[fetchPlacesBankPage] Supabase error:', error.message, {
      columns: usedColumns,
    });

    if (!isPlacesSelectSchemaError(error.message ?? '')) {
      break;
    }
  }

  // Country filter matched nothing — retry without country so the bank is not empty
  if (!error && countries.length > 0 && (count ?? 0) === 0 && !(data?.length)) {
    console.warn('[fetchPlacesBankPage] country filter returned 0 — retrying without country');
    const result = await run(usedColumns, true);
    if (!result.error) {
      data = result.data as unknown[] | null;
      count = result.count;
      error = null;
    } else {
      console.error('[fetchPlacesBankPage] retry without country failed:', result.error.message);
      error = result.error;
    }
  }

  if (error) {
    console.error('[fetchPlacesBankPage] final failure:', error.message);
    throw error;
  }

  const rows = (data ?? []) as unknown as PlaceBankRow[];
  const filtered =
    countries.length > 0
      ? filterPlacesBankInventory(rows, { countries })
      : rows;

  // If soft filter wiped the page but DB had rows, keep DB rows (avoid empty UI)
  const finalRows = filtered.length > 0 || countries.length === 0 ? filtered : rows;

  return {
    rows: finalRows,
    total: count ?? finalRows.length,
  };
}

/** مدن مميزة لفلتر الواجهة — مسح خفيف لعمود city فقط */
export async function fetchPlacesBankCityOptions(
  client: SupabaseClient,
  countries?: string[],
): Promise<string[]> {
  const countryTerms = expandCountryMatchTerms(
    (countries ?? []).map((c) => c.trim()).filter(Boolean),
  );
  const cities = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; offset < 4000; offset += pageSize) {
    let q = client.from(PLACES_BANK_TABLE).select('city').order('city', { ascending: true });
    if (countryTerms.length) {
      q = q.in('country', [...new Set(countryTerms)].slice(0, 40));
    }
    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) {
      console.error('[fetchPlacesBankCityOptions]', error.message);
      if (countryTerms.length) {
        const fallback = await client
          .from(PLACES_BANK_TABLE)
          .select('city')
          .order('city', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (fallback.error) throw fallback.error;
        for (const row of fallback.data ?? []) {
          const city = String((row as { city?: string }).city ?? '').trim();
          if (city) cities.add(city);
        }
        if ((fallback.data?.length ?? 0) < pageSize) break;
        continue;
      }
      throw error;
    }
    if (!data?.length) break;
    for (const row of data) {
      const city = String((row as { city?: string }).city ?? '').trim();
      if (city) cities.add(city);
    }
    if (data.length < pageSize) break;
  }

  return [...cities].sort((a, b) => a.localeCompare(b, 'ar'));
}

export function placeBankCategoryLabel(code: string): string {
  return PLACES_BANK_CATEGORIES[code] ?? PLACES_BANK_CATEGORIES.o ?? '🧭 أخرى';
}

export function placeBankMapsSearchUrl(
  place: Pick<PlaceBankRow, 'name' | 'city' | 'country' | 'branch_name' | 'map_url' | 'maps_url' | 'google_maps_url'>,
): string {
  const direct = String(place.map_url || place.maps_url || place.google_maps_url || '').trim();
  if (direct) return direct;
  const q = [place.name, place.branch_name, place.city, place.country].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

export function placeBankGeocodeQuery(
  place: Pick<PlaceBankRow, 'name' | 'city' | 'country' | 'branch_name'>,
): string {
  return [place.name, place.branch_name, place.city, place.country].filter(Boolean).join(', ');
}
