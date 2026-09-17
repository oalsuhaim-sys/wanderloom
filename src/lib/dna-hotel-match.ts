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
import { filterQuotationHotelsByCity, type QuotationHotelPlace } from '@/lib/crm-quotations';

/** Actual `hotels.category` codes in Supabase. */
export type HotelCategory =
  | 'ultra_luxury'
  | 'boutique_design'
  | 'apartments_luxe'
  | 'smart_choice';

const CATEGORY_LABEL_AR: Record<HotelCategory, string> = {
  ultra_luxury: 'فاخر جداً',
  boutique_design: 'بوتيك مصمّم',
  apartments_luxe: 'شقق فاخرة',
  smart_choice: 'خيار ذكي',
};

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
    const city = String(day.city ?? '').trim();
    if (!city) continue;
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

/** Pick up to `count` hotels for a city matching the preferred categories, best-fit first. */
function pickHotelsForCity(
  cityHotels: QuotationHotelPlace[],
  preferredCategories: HotelCategory[],
  count: number,
): QuotationHotelPlace[] {
  const picked: QuotationHotelPlace[] = [];
  const seen = new Set<string>();
  const take = (h: QuotationHotelPlace) => {
    const key = `${h.name}|${h.city}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(h);
  };
  // 1) exact category preference order
  for (const cat of preferredCategories) {
    for (const h of cityHotels) {
      if (picked.length >= count) break;
      if (String(h.category ?? '').trim() === cat) take(h);
    }
    if (picked.length >= count) break;
  }
  // 2) fill remaining with any hotel in the city
  if (picked.length < count) {
    for (const h of cityHotels) {
      if (picked.length >= count) break;
      take(h);
    }
  }
  return picked.slice(0, count);
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
  const preferred = hotelCategoriesForPreference(params.hotelPreference);

  const options: QuotationHotelOption[] = [];
  const citiesWithoutHotels: string[] = [];
  let citiesMatched = 0;
  let cursorNights = 0;

  for (const { city, nights } of sequence) {
    const checkIn = params.startDate ? addDays(params.startDate, cursorNights) : '';
    const checkOut = params.startDate ? addDays(params.startDate, cursorNights + nights) : '';
    cursorNights += nights;

    const cityHotels = filterQuotationHotelsByCity(params.hotelBank, city);
    if (!cityHotels.length) {
      citiesWithoutHotels.push(city);
      continue;
    }
    const chosen = pickHotelsForCity(cityHotels, preferred, perCity);
    if (chosen.length) citiesMatched += 1;

    for (const hotel of chosen) {
      const catLabel = CATEGORY_LABEL_AR[hotel.category as HotelCategory] ?? hotel.category ?? '';
      const dateRange =
        checkIn && checkOut ? ` · ${formatArDate(checkIn)} → ${formatArDate(checkOut)}` : '';
      options.push({
        ...createEmptyHotelOption(),
        city,
        name: hotel.name,
        description: `${nights} ليالٍ · ${catLabel}${dateRange}`,
        price: 0,
        is_selected_by_client: false,
      });
    }
  }

  return { options, citiesMatched, citiesWithoutHotels };
}
