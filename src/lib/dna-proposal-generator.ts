/**
 * Fast DNA → draft proposal builder (no Claude).
 * Allocates route days, hotels (via dna-hotel-match), activities (places bank),
 * and flight stubs locked to the client's travel_date + duration_days.
 */

import {
  createEmptyActivityOption,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyItineraryStop,
  createEmptyTransportOption,
  type QuotationActivityOption,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationItineraryStop,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import {
  createEmptyFlightProposal,
  type QuotationFlightProposal,
  type QuotationHotelPlace,
} from '@/lib/crm-quotations';
import { buildDnaHotelOptions } from '@/lib/dna-hotel-match';
import type { PlaceCandidate } from '@/lib/ai-generate-itinerary';

export type DnaProposalInput = {
  clientName: string;
  destinations: string[];
  startDate: string;
  durationDays: number;
  hotelPreference: string;
  flightSeat: string;
  dnaInterests: string[];
  dnaActivityLevel?: string;
  hotelBank: QuotationHotelPlace[];
  /** Place candidates ranked by DNA fit (per destination or pooled). */
  placeCandidates: PlaceCandidate[];
};

export type DnaProposalDraft = {
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  itineraryDays: QuotationItineraryDay[];
  hotelOptions: QuotationHotelOption[];
  activityOptions: QuotationActivityOption[];
  transportOptions: QuotationTransportOption[];
  flightProposals: QuotationFlightProposal[];
  citiesMatchedHotels: number;
  citiesWithoutHotels: string[];
  stopsFilled: number;
};

/** Add calendar days in UTC (YYYY-MM-DD). */
export function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) return '';
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(utc + days * 86_400_000).toISOString().slice(0, 10);
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

function normalizeDestinations(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const d of raw) {
    const city = String(d ?? '').trim();
    if (!city) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
  }
  return out;
}

/**
 * Spread duration across destinations (order preserved).
 * Example: 7 days, [Tokyo, Osaka] → 4 + 3.
 * If duration < city count, only the first N cities get 1 day each.
 */
export function allocateCityNights(
  destinations: string[],
  durationDays: number,
): Array<{ city: string; nights: number }> {
  const cities = normalizeDestinations(destinations);
  const days = Math.max(1, Math.trunc(durationDays) || 1);
  if (!cities.length) {
    return [{ city: 'وجهة قيد التحديد', nights: days }];
  }
  if (cities.length === 1) {
    return [{ city: cities[0]!, nights: days }];
  }
  if (days <= cities.length) {
    return cities.slice(0, days).map((city) => ({ city, nights: 1 }));
  }
  const base = Math.floor(days / cities.length);
  let rem = days % cities.length;
  return cities.map((city) => {
    const nights = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    return { city, nights };
  });
}

function mapPlaceCategory(raw?: string, interests: string[] = []): string {
  const c = String(raw ?? '').trim().toLowerCase();
  if (/hotel|lodg|resort|إقام|فندق/.test(c)) return 'h';
  if (/cafe|coffee|قهو|مقهى/.test(c)) return 'c';
  if (/restaurant|food|dining|مطعم|مأكول|culinary/.test(c)) return 'r';
  if (/shop|mall|retail|تسوق|fashion/.test(c)) return 's';
  if (/museum|landmark|heritage|تاريخ|معلم|attraction/.test(c)) return 'l';
  if (/spa|wellness|massage|سبا|استرخ/.test(c)) return 'd';
  if (/park|nature|hike|outdoor|طبيعة|جبال/.test(c)) return 'l';
  if (/experience|tour|activity|تجرب/.test(c)) return 'd';

  const joined = interests.join(' ').toLowerCase();
  if (/مطعم|طعام|food|مأكول/.test(joined)) return 'r';
  if (/تسوق|shop/.test(joined)) return 's';
  if (/سبا|استرخ|relax/.test(joined)) return 'd';
  if (/طبيع|nature/.test(joined)) return 'l';
  return 'o';
}

const STOP_TIMES = ['09:30', '11:30', '14:00', '16:30', '19:30'] as const;

function candidatesForCity(
  city: string,
  all: PlaceCandidate[],
): PlaceCandidate[] {
  const cityNorm = city.trim().toLowerCase();
  if (!cityNorm) return all;
  const exact = all.filter((p) => String(p.city ?? '').trim().toLowerCase() === cityNorm);
  if (exact.length) return exact;
  const soft = all.filter((p) => {
    const pc = String(p.city ?? '').trim().toLowerCase();
    return pc && (pc.includes(cityNorm) || cityNorm.includes(pc));
  });
  return soft.length ? soft : all;
}

function buildStopsForDay(params: {
  city: string;
  dayNumber: number;
  interests: string[];
  pool: PlaceCandidate[];
  usedPlaceIds: Set<string>;
  perDay: number;
}): QuotationItineraryStop[] {
  const cityPool = candidatesForCity(params.city, params.pool);
  const picks: PlaceCandidate[] = [];
  for (const place of cityPool) {
    if (picks.length >= params.perDay) break;
    if (params.usedPlaceIds.has(place.id)) continue;
    picks.push(place);
    params.usedPlaceIds.add(place.id);
  }
  // If city pool exhausted, allow reuse from global unused
  if (picks.length < params.perDay) {
    for (const place of params.pool) {
      if (picks.length >= params.perDay) break;
      if (params.usedPlaceIds.has(place.id)) continue;
      picks.push(place);
      params.usedPlaceIds.add(place.id);
    }
  }

  const interestLabel =
    params.interests.slice(0, 2).join(' · ') || 'اهتمامات DNA';

  return picks.map((place, idx) => {
    const stop = createEmptyItineraryStop();
    const category = mapPlaceCategory(place.category, params.interests);
    return {
      ...stop,
      time: STOP_TIMES[idx] ?? '12:00',
      title: place.name,
      category,
      notes: `مقترح من DNA · ${interestLabel}${place.sub_tag ? ` · ${place.sub_tag}` : ''}`,
      search_keyword: place.name_en || place.name,
      place_id: place.id,
      place_real_name: place.name,
    };
  });
}

/** Build day-by-day itinerary from destinations + duration + DNA place matches. */
export function buildDnaItineraryDays(params: {
  destinations: string[];
  startDate: string;
  durationDays: number;
  interests: string[];
  placeCandidates: PlaceCandidate[];
  stopsPerDay?: number;
}): QuotationItineraryDay[] {
  const allocation = allocateCityNights(params.destinations, params.durationDays);
  const used = new Set<string>();
  const stopsPerDay = Math.max(2, Math.min(5, params.stopsPerDay ?? 3));
  const days: QuotationItineraryDay[] = [];
  let dayNumber = 1;
  let cursor = 0;

  for (const { city, nights } of allocation) {
    for (let n = 0; n < nights; n += 1) {
      const date = params.startDate ? addDaysIso(params.startDate, cursor) : '';
      cursor += 1;
      const base = createEmptyItineraryDay(dayNumber);
      const stops = buildStopsForDay({
        city,
        dayNumber,
        interests: params.interests,
        pool: params.placeCandidates,
        usedPlaceIds: used,
        perDay: stopsPerDay,
      });
      days.push({
        ...base,
        dayNumber,
        date,
        city,
        title: `اليوم ${dayNumber} · ${city}`,
        description:
          params.interests.length > 0
            ? `مسار مصمّم حسب DNA: ${params.interests.slice(0, 4).join(' · ')}`
            : `مسار ${city}`,
        stops,
      });
      dayNumber += 1;
    }
  }

  return days;
}

export function buildDnaActivityOptions(params: {
  placeCandidates: PlaceCandidate[];
  interests: string[];
  limit?: number;
}): QuotationActivityOption[] {
  const limit = Math.max(1, params.limit ?? 6);
  const interestLabel = params.interests.slice(0, 3).join(' · ') || 'اهتمامات العميل';
  const options: QuotationActivityOption[] = [];
  const seen = new Set<string>();

  for (const place of params.placeCandidates) {
    if (options.length >= limit) break;
    const key = place.id || place.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push({
      ...createEmptyActivityOption(),
      name: place.name,
      description: `${place.city ? `${place.city} · ` : ''}${interestLabel}${
        place.category ? ` · ${place.category}` : ''
      }`,
      price: 0,
      is_selected_by_client: false,
    });
  }

  if (!options.length) {
    return [{ ...createEmptyActivityOption() }];
  }
  return options;
}

/** Map DNA seat preference → flight class label. */
export function flightClassFromDnaSeat(seatRaw: string): string {
  const s = String(seatRaw ?? '').trim().toLowerCase();
  if (!s) return 'رجال أعمال';
  if (/first|أولى|اولى|f\b/.test(s)) return 'درجة أولى';
  if (/business|رجال|أعمال|اعمال|جوهرة|jewel/.test(s)) return 'رجال أعمال';
  if (/premium|مميزة|بريميوم/.test(s)) return 'اقتصادية مميزة';
  if (/economy|اقتصاد|سياح/.test(s)) return 'اقتصادية';
  return seatRaw.trim() || 'رجال أعمال';
}

export function buildDnaFlightProposals(params: {
  destinations: string[];
  startDate: string;
  endDate: string;
  flightSeat: string;
}): QuotationFlightProposal[] {
  const cities = normalizeDestinations(params.destinations);
  const firstCity = cities[0] || 'الوجهة';
  const lastCity = cities[cities.length - 1] || firstCity;
  const flightClass = flightClassFromDnaSeat(params.flightSeat);
  const startLabel = formatArDate(params.startDate) || params.startDate;
  const endLabel = formatArDate(params.endDate) || params.endDate;

  const outbound: QuotationFlightProposal = {
    ...createEmptyFlightProposal(),
    departureCity: 'الرياض',
    arrivalCity: firstCity,
    airline: `ذهاب · ${startLabel}`,
    flight_class: flightClass,
    price: 0,
  };
  const inbound: QuotationFlightProposal = {
    ...createEmptyFlightProposal(),
    departureCity: lastCity,
    arrivalCity: 'الرياض',
    airline: `عودة · ${endLabel}`,
    flight_class: flightClass,
    price: 0,
  };
  return [outbound, inbound];
}

/** Full tailor-made draft from DNA + trip window. */
export function buildDnaProposalDraft(input: DnaProposalInput): DnaProposalDraft {
  const destinations = normalizeDestinations(input.destinations);
  const durationDays = Math.max(1, Math.trunc(input.durationDays) || 1);
  const startDate = String(input.startDate ?? '').trim().slice(0, 10);
  const endDate = startDate ? addDaysIso(startDate, durationDays - 1) : '';
  const interests = (input.dnaInterests ?? []).map((x) => String(x).trim()).filter(Boolean);
  const destLabel = destinations.length ? destinations.join(' · ') : 'رحلة';
  const name = String(input.clientName ?? '').trim() || 'عميل';

  const itineraryDays = buildDnaItineraryDays({
    destinations: destinations.length ? destinations : ['وجهة قيد التحديد'],
    startDate,
    durationDays,
    interests,
    placeCandidates: input.placeCandidates ?? [],
  });

  const hotelMatch = buildDnaHotelOptions({
    itineraryDays,
    hotelBank: input.hotelBank ?? [],
    hotelPreference: input.hotelPreference ?? '',
    startDate,
    perCity: 2,
  });

  const activityOptions = buildDnaActivityOptions({
    placeCandidates: input.placeCandidates ?? [],
    interests,
    limit: 6,
  });

  const flightProposals = buildDnaFlightProposals({
    destinations: destinations.length ? destinations : [destLabel],
    startDate,
    endDate,
    flightSeat: input.flightSeat ?? '',
  });

  const stopsFilled = itineraryDays.reduce((n, d) => n + (d.stops?.length ?? 0), 0);

  return {
    title: `عرض سعر DNA · ${name} · ${destLabel}`,
    destinations: destinations.length ? destinations : [],
    startDate,
    endDate,
    itineraryDays,
    hotelOptions: hotelMatch.options.length ? hotelMatch.options : [createEmptyHotelOption()],
    activityOptions,
    transportOptions: [
      {
        ...createEmptyTransportOption(),
        name: 'سيارة خاصة VIP',
        description: 'نقل فاخر طوال أيام الرحلة — راجع التسعير',
        price: 0,
        is_selected_by_client: false,
      },
    ],
    flightProposals,
    citiesMatchedHotels: hotelMatch.citiesMatched,
    citiesWithoutHotels: hotelMatch.citiesWithoutHotels,
    stopsFilled,
  };
}
