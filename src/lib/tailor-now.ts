/**
 * «فصّل الآن» / Tailor Now — shared (client-safe) model, pricing and day mapping.
 *
 * The visitor picks cities + days per city, answers a few style questions, and gets
 * Day 1 of a day-by-day plan built from the places bank. The remaining days are generated
 * only after the bank transfer is confirmed from the CRM (so unpaid days never exist).
 */

export type TailorLocale = 'ar' | 'en';

export const TAILOR_MIN_DAYS = 3;
export const TAILOR_MAX_DAYS = 30;
export const TAILOR_MAX_CITIES = 6;
/** Per-day price (SAR): trips under TAILOR_LONG_TRIP_DAYS days. */
export const TAILOR_RATE_SHORT = 120;
/** Per-day price (SAR): trips of TAILOR_LONG_TRIP_DAYS days or more. */
export const TAILOR_RATE_LONG = 100;
export const TAILOR_LONG_TRIP_DAYS = 12;
export const TAILOR_CURRENCY = 'SAR';
/** A city needs at least this many active places in the bank to be offered. */
export const TAILOR_MIN_CITY_PLACES = 12;

export type TailorSegment = {
  /** Exact `places.city` label from the bank (Arabic free text). */
  city: string;
  days: number;
};

export type TailorAnswers = {
  travelers: 'solo' | 'couple' | 'family' | 'friends';
  travelersCount: number;
  pace: 'calm' | 'balanced' | 'active';
  dayStart: 'early' | 'mid' | 'late';
  interests: string[];
  food: string[];
  lodging: 'boutique' | 'luxury' | 'comfort';
  budget: 'comfort' | 'premium' | 'unlimited';
  dream: string;
  notes: string;
  season?: string;
};

export type TailorStop = {
  beat: string;
  time: string;
  title: string;
  notes: string;
  category: string;
  placeId?: string;
  placeName?: string;
  mapsUrl?: string;
};

export type TailorDay = {
  dayNumber: number;
  city: string;
  title: string;
  summary: string;
  stops: TailorStop[];
};

export type TailorPlanStatus = 'preview' | 'receipt_submitted' | 'paid' | 'ready' | 'failed';

export type TailorDaySlot = {
  dayNumber: number;
  city: string;
  dayInCity: number;
  cityDays: number;
  /** First day in a city that isn't the trip's first city (travel between cities). */
  isTransfer: boolean;
  isFirstDay: boolean;
  isLastDay: boolean;
};

/** What the public plan page receives — never includes contact details or internal fields. */
export type PublicTailorPlan = {
  token: string;
  locale: TailorLocale;
  firstName: string;
  countryId: string;
  countryLabel: string;
  segments: TailorSegment[];
  startDate: string | null;
  daysTotal: number;
  pricePerDay: number;
  totalPrice: number;
  currency: string;
  status: TailorPlanStatus;
  unlocked: boolean;
  days: TailorDay[];
  slots: TailorDaySlot[];
  /** Day numbers the visitor is entitled to that aren't generated yet. */
  pendingDays: number[];
  receiptSubmitted: boolean;
  lastError: string | null;
};

export type TailorDestinationCity = {
  label: string;
  places: number;
  maxDays: number;
};

export type TailorDestination = {
  id: string;
  label: string;
  cities: TailorDestinationCity[];
};

export function tailorRatePerDay(daysTotal: number): number {
  return daysTotal >= TAILOR_LONG_TRIP_DAYS ? TAILOR_RATE_LONG : TAILOR_RATE_SHORT;
}

export function tailorTotalPrice(daysTotal: number): number {
  return Math.max(0, Math.trunc(daysTotal)) * tailorRatePerDay(daysTotal);
}

export function tailorDaysTotal(segments: TailorSegment[]): number {
  return segments.reduce((n, s) => n + Math.max(0, Math.trunc(Number(s.days) || 0)), 0);
}

/** Max days we offer in one city, based on how many places the bank holds there. */
export function tailorCityMaxDays(placeCount: number): number {
  return Math.max(1, Math.min(14, Math.floor(placeCount / 7)));
}

/** Maps every trip day to its city, in travel order. */
export function tailorDaySlots(segments: TailorSegment[]): TailorDaySlot[] {
  const slots: TailorDaySlot[] = [];
  const total = tailorDaysTotal(segments);
  let dayNumber = 0;
  segments.forEach((seg, segIndex) => {
    const cityDays = Math.max(0, Math.trunc(Number(seg.days) || 0));
    for (let i = 1; i <= cityDays; i += 1) {
      dayNumber += 1;
      slots.push({
        dayNumber,
        city: seg.city,
        dayInCity: i,
        cityDays,
        isTransfer: segIndex > 0 && i === 1,
        isFirstDay: dayNumber === 1,
        isLastDay: dayNumber === total,
      });
    }
  });
  return slots;
}

export function formatSar(amount: number, locale: TailorLocale): string {
  const n = Math.round(amount);
  return locale === 'en'
    ? `SAR ${n.toLocaleString('en-US')}`
    : `${n.toLocaleString('ar-SA-u-nu-latn')} ريال`;
}

export function isTailorLocale(value: unknown): value is TailorLocale {
  return value === 'ar' || value === 'en';
}

/** Interest keys (stored) — labels live in the page copy. */
export const TAILOR_INTERESTS = [
  'culture',
  'nature',
  'food',
  'coffee',
  'shopping',
  'art',
  'photo',
  'adventure',
  'wellness',
  'family',
  'nightlife',
  'pop',
] as const;

export const TAILOR_FOOD = ['halal', 'seafood', 'vegetarian', 'flexible'] as const;
