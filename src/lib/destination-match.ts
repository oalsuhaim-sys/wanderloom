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

/**
 * English names for places-bank city labels (bank labels are Arabic free text).
 * Used only on English pages so they never show Arabic place names.
 */
const PLACE_EN: Record<string, string> = {
  طوكيو: 'Tokyo', 'كيوتو/أوساكا': 'Kyoto / Osaka', كيوتو: 'Kyoto', أوساكا: 'Osaka', هوكايدو: 'Hokkaido',
  سيول: 'Seoul', بوسان: 'Busan', جيجو: 'Jeju', 'جزيرة جيجو': 'Jeju Island', غانغوون: 'Gangwon', تشونغتشونغ: 'Chungcheong',
  شنغهاي: 'Shanghai', غوانزو: 'Guangzhou', كوانزو: 'Guangzhou', بكين: 'Beijing', بالي: 'Bali', جاكرتا: 'Jakarta',
  لندن: 'London', اسكتلندا: 'Scotland', إدنبرة: 'Edinburgh', باريس: 'Paris', آنسي: 'Annecy', ستراسبورغ: 'Strasbourg', نيس: 'Nice',
  روما: 'Rome', فلورنسا: 'Florence', ميلانو: 'Milan', فينيسيا: 'Venice', 'شمال إيطاليا': 'Northern Italy',
  إنترلاكن: 'Interlaken', زيرمات: 'Zermatt', زيورخ: 'Zurich', جنيف: 'Geneva', لوسيرن: 'Lucerne',
  مدريد: 'Madrid', برشلونة: 'Barcelona', غرناطة: 'Granada', مالقا: 'Málaga', 'ملقا / الأندلس': 'Málaga / Andalusia', بالما: 'Palma',
  لشبونة: 'Lisbon', بورتو: 'Porto', ميونخ: 'Munich', فرانكفورت: 'Frankfurt', برلين: 'Berlin', دوسلدورف: 'Düsseldorf',
  شتوتغارت: 'Stuttgart', كولن: 'Cologne', فوسن: 'Füssen', فيينا: 'Vienna', سالزبورغ: 'Salzburg', هالشتات: 'Hallstatt',
  أمستردام: 'Amsterdam', روتردام: 'Rotterdam', بروكسل: 'Brussels', بروج: 'Bruges', براغ: 'Prague', بودابست: 'Budapest',
  كراكوف: 'Kraków', وارسو: 'Warsaw', ستوكهولم: 'Stockholm', موسكو: 'Moscow', 'سانت بطرسبرغ': 'Saint Petersburg',
  'كيب تاون': 'Cape Town', جوهانسبرغ: 'Johannesburg', تورونتو: 'Toronto', فانكوفر: 'Vancouver', مونتريال: 'Montréal',
  أوتاوا: 'Ottawa', بانف: 'Banff', فيكتوريا: 'Victoria', كيبك: 'Québec', نياغارا: 'Niagara', ويسلر: 'Whistler',
  نيويورك: 'New York', 'لوس أنجلوس': 'Los Angeles', ميامي: 'Miami',
};
const PLACE_EN_NORM = new Map(Object.entries(PLACE_EN).map(([k, v]) => [norm(k), v]));

/** English name for an Arabic place label (city, or a country used as a city), or undefined. */
export function englishPlaceName(label: string | null | undefined, enCountries?: Record<string, string>): string | undefined {
  if (!label) return undefined;
  const hit = PLACE_EN_NORM.get(norm(label));
  if (hit) return hit;
  const country = canonicalTripCountryId(label);
  return country && enCountries ? enCountries[country] : undefined;
}

/** Canonical TRIP_DESTINATIONS city id for a bank city entry, if one matches. */
export function canonicalCityId(countryId: TripCountryId, city: { id: string; labelAr: string }): string | undefined {
  const def = TRIP_DESTINATIONS.find((c) => c.id === countryId);
  return def?.cities.find((c) => cityMatches(city, countryId, c.id))?.id;
}
