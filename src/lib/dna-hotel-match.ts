/**
 * DNA → hotels matcher.
 *
 * Picks 2 hotels per city from the `hotels` bank matched to the client's
 * Travel-DNA lodging style, and computes each hotel's check-in/out dates from
 * the trip start date + the day-count per city (in itinerary order).
 * No external APIs — uses the already-fetched hotel bank rows.
 */

import {
  createEmptyHotelOption,
  type QuotationHotelOption,
  type QuotationItineraryDay,
} from '@/lib/interactive-quotation';
import {
  dedupeQuotationHotelPlaces,
  filterQuotationHotelsByCity,
  type QuotationHotelPlace,
} from '@/lib/crm-quotations';
import { bankRowMatches, parseDestination } from '@/lib/trip-destination-normalize';

/** Actual `hotels.category` codes in Supabase. */
export type HotelCategory =
  | 'ultra_luxury'
  | 'boutique_design'
  | 'apartments_luxe'
  | 'smart_choice';

/**
 * Map a free-text DNA lodging preference to an ordered list of acceptable
 * hotel categories (best fit first). Unknown/empty → sensible luxury default.
 */
export function hotelCategoriesForPreference(preferenceRaw: string): HotelCategory[] {
  const p = String(preferenceRaw ?? '').trim().toLowerCase();

  const has = (...needles: string[]) => needles.some((n) => p.includes(n));

  // شقق / عائلي واسع
  if (has('شقة', 'شقق', 'apartment', 'apart', 'عائل', 'family', 'residence', 'suite kitchen'))
    return ['apartments_luxe', 'ultra_luxury', 'boutique_design'];

  // بوتيك / تصميم / هادئ / ريوكان
  if (has('بوتيك', 'boutique', 'تصميم', 'design', 'هادئ', 'quiet', 'ryokan', 'ريوكان', 'تراث', 'اصيل', 'أصيل'))
    return ['boutique_design', 'ultra_luxury', 'apartments_luxe'];

  // اقتصادي / ذكي / قيمة
  if (has('اقتصاد', 'smart', 'ذكي', 'value', 'budget', 'موفّر', 'موفر', 'معقول'))
    return ['smart_choice', 'boutique_design', 'apartments_luxe'];

  // فاخر / خمس نجوم / VIP (والافتراضي)
  return ['ultra_luxury', 'boutique_design', 'apartments_luxe'];
}

/** Cities in itinerary order with their night counts (dedup, order-preserving). */
export function citySequenceFromItinerary(
  days: QuotationItineraryDay[],
): Array<{ city: string; nights: number }> {
  const order: string[] = [];
  const nights = new Map<string, number>();
  for (const day of days) {
    const raw = String(day.city ?? '').trim();
    if (!raw) continue;
    const city = parseDestination(raw)?.label ?? raw;
    if (!nights.has(city)) order.push(city);
    nights.set(city, (nights.get(city) ?? 0) + 1);
  }
  return order.map((city) => ({ city, nights: nights.get(city) ?? 1 }));
}

/** Add days in UTC to avoid off-by-one from local-time ↔ UTC conversions. */
function addDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) return '';
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const shifted = new Date(utc + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function formatArDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  try {
    return new Intl.DateTimeFormat('ar', {
      day: 'numeric',
      month: 'short',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return iso;
  }
}

/** Hotel tier read from the bank's mixed category values (codes and Arabic labels). */
export type HotelTier = 'luxury5' | 'signature' | 'boutique' | 'smart4' | 'apartments';

export const HOTEL_TIER_LABEL_AR: Record<HotelTier, string> = {
  luxury5: 'فاخر 5 نجوم',
  signature: 'إقامة استثنائية',
  boutique: 'بوتيك مصمّم',
  smart4: '4 نجوم مختار',
  apartments: 'شقق فاخرة',
};

export function hotelTier(categoryRaw: unknown): HotelTier {
  const c = String(categoryRaw ?? '').trim().toLowerCase();
  if (/apart|شقق|شقة/.test(c)) return 'apartments';
  if (/boutique|بوتيك/.test(c)) return 'boutique';
  if (/smart|اقتصاد|ذكي/.test(c)) return 'smart4';
  if (/تجربة سكن|signature/.test(c)) return 'signature';
  return 'luxury5'; // ultra_luxury · فاخر جداً · منتجع VIP
}

/**
 * Stay types the client asked for, best first. Reads the trip form choices
 * (star4 / star5 / boutique / ryokan …) and the DNA free text.
 */
export function requestedHotelTiers(requestRaw: string): HotelTier[] {
  const p = String(requestRaw ?? '').toLowerCase();
  const out: HotelTier[] = [];
  const add = (...t: HotelTier[]) => t.forEach((x) => (out.includes(x) ? null : out.push(x)));
  if (/boutique|بوتيك|تصميم|design/.test(p)) add('boutique');
  if (/star4|4 نجوم|اربع|أربع|four/.test(p)) add('smart4');
  if (/star5|5 نجوم|خمس|five|فاخر|luxury|vip/.test(p)) add('luxury5', 'signature');
  if (/ryokan|ريوكان|تراث|اصيل|أصيل|traditional/.test(p)) add('boutique', 'signature');
  if (/شقة|شقق|apartment|عائل|family|villa|فيلا/.test(p)) add('apartments');
  if (/اقتصاد|smart|ذكي|value|budget|موفر|معقول/.test(p)) add('smart4');
  return out.length ? out : ['luxury5', 'boutique', 'signature'];
}

/** «قريبة من السنتر» → favour hotels in central districts. */
function wantsCentral(requestRaw: string): boolean {
  return /سنتر|السنتر|وسط|مركز|center|centre|central|downtown/i.test(String(requestRaw ?? ''));
}

const CENTRAL_HINTS = /myeongdong|jongno|gwanghwamun|euljiro|sewoon|jung-gu|city hall|shinjuku|ginza|marunouchi|shibuya|tokyo station|gion|namba|umeda|haeundae|seomyeon|nampo|mayfair|covent|soho|opera|louvre|champs/i;

function scoreHotel(h: QuotationHotelPlace, central: boolean): number {
  return central && CENTRAL_HINTS.test(h.name) ? 1 : 0;
}

/** Up to `count` hotels for a city: one per requested tier first, never from another city. */
function pickHotelsForCity(
  cityHotels: QuotationHotelPlace[],
  tiers: HotelTier[],
  count: number,
  central: boolean,
): { hotel: QuotationHotelPlace; tier: HotelTier; requested: boolean }[] {
  const picked: { hotel: QuotationHotelPlace; tier: HotelTier; requested: boolean }[] = [];
  const seen = new Set<string>();
  const ranked = [...cityHotels].sort((a, b) => scoreHotel(b, central) - scoreHotel(a, central));
  const take = (h: QuotationHotelPlace, requested: boolean) => {
    const key = h.name.trim().toLowerCase();
    if (seen.has(key) || picked.length >= count) return;
    seen.add(key);
    picked.push({ hotel: h, tier: hotelTier(h.category), requested });
  };
  // 1) one per requested tier, in the client's order
  for (const t of tiers) {
    const h = ranked.find((x) => hotelTier(x.category) === t && !seen.has(x.name.trim().toLowerCase()));
    if (h) take(h, true);
  }
  // 2) more from the requested tiers
  for (const h of ranked) if (tiers.includes(hotelTier(h.category))) take(h, true);
  // 3) nothing requested exists in this city → closest available, flagged
  if (!picked.length) for (const h of ranked) take(h, false);
  return picked;
}

export type DnaHotelMatchResult = {
  options: QuotationHotelOption[];
  citiesMatched: number;
  citiesWithoutHotels: string[];
};

/**
 * Build 2 hotel options per city from the DNA lodging preference + itinerary.
 * Prices are left at 0 for the expert to fill. Options are not pre-selected.
 */
export function buildDnaHotelOptions(params: {
  itineraryDays: QuotationItineraryDay[];
  hotelBank: QuotationHotelPlace[];
  hotelPreference: string;
  startDate: string;
  perCity?: number;
}): DnaHotelMatchResult {
  const perCity = Math.max(1, params.perCity ?? 2);
  const sequence = citySequenceFromItinerary(params.itineraryDays);
  const tiers = requestedHotelTiers(params.hotelPreference);
  const central = wantsCentral(params.hotelPreference);

  const options: QuotationHotelOption[] = [];
  const citiesWithoutHotels: string[] = [];
  let citiesMatched = 0;
  let cursorNights = 0;

  for (const { city, nights } of sequence) {
    const checkIn = params.startDate ? addDays(params.startDate, cursorNights) : '';
    const checkOut = params.startDate ? addDays(params.startDate, cursorNights + nights) : '';
    cursorNights += nights;

    const dest = parseDestination(city);
    // Strict: the hotel's own city must match (no country-wide fallback that put Seoul hotels in Jeju).
    const cityHotels = dest
      ? dedupeQuotationHotelPlaces(params.hotelBank.filter((h) => bankRowMatches(dest, h)), 'name')
      : filterQuotationHotelsByCity(params.hotelBank, city);
    if (!cityHotels.length) {
      citiesWithoutHotels.push(dest?.label ?? city);
      continue;
    }
    const chosen = pickHotelsForCity(cityHotels, tiers, perCity, central);
    if (chosen.length) citiesMatched += 1;

    for (const { hotel, tier, requested } of chosen) {
      const dateRange =
        checkIn && checkOut ? ` · ${formatArDate(checkIn)} → ${formatArDate(checkOut)}` : '';
      const nightsLabel = nights === 1 ? 'ليلة واحدة' : nights === 2 ? 'ليلتان' : `${nights} ليالٍ`;
      options.push({
        ...createEmptyHotelOption(),
        city: dest?.label ?? city,
        name: hotel.name,
        description: `${HOTEL_TIER_LABEL_AR[tier]}${requested ? '' : ' (أقرب خيار متاح)'} · ${nightsLabel}${dateRange}`,
        price: 0,
        is_selected_by_client: false,
      });
    }
  }

  return { options, citiesMatched, citiesWithoutHotels };
}
