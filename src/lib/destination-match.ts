import { TRIP_DESTINATIONS, type TripCountryId } from '@/lib/trip-destination-data';

/**
 * Places-bank country labels are free text («كوريا», «بريطانيا »…) and don't always match the
 * curated TRIP_DESTINATIONS labels («كوريا الجنوبية»). These helpers map either form to the
 * canonical id WITHOUT changing the ids the forms/filters already use.
 */
const ALIASES: Partial<Record<TripCountryId, string[]>> = {
  korea: ['كوريا', 'كوريا الجنوبية', 'South Korea', 'Korea', 'KR'],
  usa: ['أمريكا', 'الولايات المتحدة', 'الولايات المتحدة الأمريكية', 'United States', 'USA', 'US', 'America'],
  uk: ['بريطانيا', 'المملكة المتحدة', 'إنجلترا', 'United Kingdom', 'UK', 'Britain', 'England'],
  czech: ['التشيك', 'جمهورية التشيك', 'تشيكيا', 'Czechia', 'Czech Republic'],
  netherlands: ['هولندا', 'Netherlands', 'Holland'],
  south_africa: ['جنوب أفريقيا', 'South Africa'],
  hungary: ['المجر', 'هنغاريا', 'Hungary'],
  indonesia: ['إندونيسيا', 'بالي', 'Indonesia', 'Bali'],
  japan: ['اليابان', 'Japan'],
  china: ['الصين', 'China'],
  canada: ['كندا', 'Canada'],
  germany: ['ألمانيا', 'Germany'],
  spain: ['إسبانيا', 'Spain'],
  italy: ['إيطاليا', 'Italy'],
  france: ['فرنسا', 'France'],
  portugal: ['البرتغال', 'Portugal'],
  belgium: ['بلجيكا', 'Belgium'],
  poland: ['بولندا', 'Poland'],
  austria: ['النمسا', 'Austria'],
  sweden: ['السويد', 'Sweden'],
  russia: ['روسيا', 'Russia'],
  switzerland: ['سويسرا', 'Switzerland'],
};

function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ـ/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[_\s]+/g, ' ');
}

const LOOKUP: Map<string, TripCountryId> = (() => {
  const map = new Map<string, TripCountryId>();
  for (const def of TRIP_DESTINATIONS) {
    const id = def.id as TripCountryId;
    map.set(norm(def.id), id);
    map.set(norm(def.labelAr), id);
    for (const alias of ALIASES[id] ?? []) map.set(norm(alias), id);
  }
  return map;
})();

/** Canonical TRIP_DESTINATIONS id for an id or label from any source, or null if unknown. */
export function canonicalTripCountryId(...candidates: Array<string | null | undefined>): TripCountryId | null {
  for (const c of candidates) {
    if (!c) continue;
    const hit = LOOKUP.get(norm(c));
    if (hit) return hit;
  }
  return null;
}

/** Find the entry in `list` (e.g. places-bank destinations) that represents `dest` (id or canonical id). */
export function findTripDestination<T extends { id: string; labelAr: string }>(list: T[], dest: string): T | undefined {
  const exact = list.find((c) => c.id === dest);
  if (exact) return exact;
  const canon = canonicalTripCountryId(dest);
  if (!canon) return undefined;
  return list.find((c) => canonicalTripCountryId(c.id, c.labelAr) === canon);
}

/** Does a city entry match a canonical city id (e.g. "seoul" ↔ «سيول»)? */
export function cityMatches(city: { id: string; labelAr: string }, countryId: TripCountryId, cityId: string): boolean {
  if (city.id === cityId) return true;
  const def = TRIP_DESTINATIONS.find((c) => c.id === countryId)?.cities.find((c) => c.id === cityId);
  if (!def) return false;
  const a = norm(city.labelAr);
  const b = norm(def.labelAr);
  return a === b || a.includes(b) || b.includes(a);
}
