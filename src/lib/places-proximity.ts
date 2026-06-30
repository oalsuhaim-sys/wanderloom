import { pickPlaceBankCoordinates } from '@/lib/itinerary-day-activities';
import { supabase } from '@/lib/supabase';
import type { PlaceBankRow } from '@/types/place';

const EARTH_RADIUS_KM = 6371;

/** أعمدة الإحداثيات القياسية في Supabase (بدون lat/lng) */
export const PROXIMITY_PLACES_SELECT =
  'id, name, latitude, longitude, image_url, country, city, category';

/** بدون إحداثيات — عند غياب أعمدة الموقع في المخطط */
export const PROXIMITY_PLACES_SELECT_MINIMAL =
  'id, name, image_url, country, city, category';

export function isPlacesCoordinateSchemaError(message: string): boolean {
  return (
    /does not exist/i.test(message) &&
    /(places\.)?(lat|lng|latitude|longitude)/i.test(message)
  );
}

export class PlacesProximityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlacesProximityUnavailableError';
  }
}

/** تجاوز حد Supabase الافتراضي (1000) — لا يُستبعد أي مكان ضمن السقف */
export const PROXIMITY_FETCH_LIMIT = 10_000;

/** نطاق العرض الافتراضي للأماكن القريبة */
export const PROXIMITY_RADIUS_KM = 5;

/** حجم الصفحة عند التجزئة (يتوافق مع max-rows الافتراضي 1000) */
const PROXIMITY_PAGE_CHUNK = 1000;

/** نقطة أصل لبحث «أماكن قريبة» من نشاط في المسار */
export type ProximityOrigin = {
  activityId: string;
  placeName: string;
  lat: number;
  lng: number;
};

export type ProximityPlaceFilters = {
  search?: string;
  country?: string;
  city?: string;
  category?: string;
};

export type PlaceWithDistance = {
  place: PlaceBankRow;
  distanceKm: number;
};

/** مسافة كبيرة بين نقطتين على الكرة — Haversine */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** تسمية عربية للمسافة — مثال: يبعد 0.8 كم */
export function formatDistanceKmAr(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 0.05) return 'في المنطقة';
  if (km < 1) return `يبعد ${km.toFixed(1)} كم`;
  if (km < 10) return `يبعد ${km.toFixed(1)} كم`;
  return `يبعد ${Math.round(km)} كم`;
}

type PlacesQuery = ReturnType<NonNullable<typeof supabase>['from']> extends (
  table: string,
) => infer Q
  ? Q
  : never;

function applyProximityFilters(
  q: PlacesQuery,
  filters: ProximityPlaceFilters,
): PlacesQuery {
  let next = q;
  if (filters.search?.trim()) {
    next = next.ilike('name', `%${filters.search.trim()}%`);
  }
  if (filters.country) next = next.eq('country', filters.country);
  if (filters.city) next = next.eq('city', filters.city);
  if (filters.category) next = next.eq('category', filters.category);
  return next;
}

/**
 * جلب حتى 10,000 مكاناً بأعمدة خفيفة لتقييم القرب.
 * 1) طلب واحد بـ `.limit(10000)` عندما يسمح الخادم بذلك
 * 2) إن وُجد سقف 1000: تجزئة `range` حتى اكتمال النتائج أو بلوغ 10,000
 */
export async function fetchPlacesForProximityEngine(
  filters: ProximityPlaceFilters,
): Promise<PlaceBankRow[]> {
  if (!supabase) {
    throw new Error('قاعدة البيانات غير مهيأة.');
  }

  const fetchRange = async (from: number, to: number): Promise<PlaceBankRow[]> => {
    let q = supabase.from('places').select(PROXIMITY_PLACES_SELECT).range(from, to);
    q = applyProximityFilters(q, filters);
    const { data, error } = await q;
    if (error) {
      if (isPlacesCoordinateSchemaError(error.message)) {
        throw new PlacesProximityUnavailableError(error.message);
      }
      throw error;
    }
    return (data ?? []) as PlaceBankRow[];
  };

  let q = supabase.from('places').select(PROXIMITY_PLACES_SELECT).limit(PROXIMITY_FETCH_LIMIT);
  q = applyProximityFilters(q, filters);
  let { data: bulk, error: bulkErr } = await q;

  if (bulkErr && isPlacesCoordinateSchemaError(bulkErr.message)) {
    throw new PlacesProximityUnavailableError(bulkErr.message);
  }
  if (bulkErr) throw bulkErr;

  const first = (bulk ?? []) as PlaceBankRow[];
  if (first.length > 0 && first.length < PROXIMITY_PAGE_CHUNK) {
    return first;
  }
  if (first.length >= PROXIMITY_FETCH_LIMIT) {
    return first.slice(0, PROXIMITY_FETCH_LIMIT);
  }

  const collected: PlaceBankRow[] = [];
  for (let start = 0; start < PROXIMITY_FETCH_LIMIT; start += PROXIMITY_PAGE_CHUNK) {
    const end = Math.min(start + PROXIMITY_PAGE_CHUNK - 1, PROXIMITY_FETCH_LIMIT - 1);
    const batch = await fetchRange(start, end);
    if (!batch.length) break;
    collected.push(...batch);
    if (batch.length < PROXIMITY_PAGE_CHUNK) break;
  }

  return collected.slice(0, PROXIMITY_FETCH_LIMIT);
}

/** Haversine + فلتر ضمن نطاق كم + ترتيب من الأقرب */
export function filterPlacesByProximity(
  origin: ProximityOrigin,
  places: PlaceBankRow[],
  maxRadiusKm: number = PROXIMITY_RADIUS_KM,
): PlaceWithDistance[] {
  const rows: PlaceWithDistance[] = [];

  for (const place of places) {
    const coords = pickPlaceBankCoordinates(place);
    if (!coords) continue;
    const distanceKm = haversineDistanceKm(
      origin.lat,
      origin.lng,
      coords.lat,
      coords.lng,
    );
    if (distanceKm > maxRadiusKm) continue;
    rows.push({ place, distanceKm });
  }

  rows.sort((a, b) => a.distanceKm - b.distanceKm);
  return rows;
}

/** ترتيب بدون سقف مسافة — للاختبارات */
export function sortPlacesByProximity(
  origin: ProximityOrigin,
  places: PlaceBankRow[],
): PlaceWithDistance[] {
  return filterPlacesByProximity(origin, places, Number.POSITIVE_INFINITY);
}

/** جلب كامل البنك (حتى 10,000) لبحث «أماكن قريبة» — بدون فلاتر دولة/بحث */
export async function fetchAllPlacesForNearbySearch(): Promise<PlaceBankRow[]> {
  return fetchPlacesForProximityEngine({});
}
