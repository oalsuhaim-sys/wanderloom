/**
 * DNA → draft proposal builder.
 * Cities are normalized («كوريا:سيول» ≡ «كوريا الجنوبية — سيول» → «سيول»), nights are spread by how
 * much the bank holds for each city, every day gets a theme from the client's interests with real
 * places from that city's bank, and hotels follow the requested stay type in the right city only.
 * The visible stop titles are sensory; real names stay in place_real_name (expert-only).
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
import { sensoryStopTitle, themesForInterests, type DayTheme } from '@/lib/dna-day-themes';
import { normalizeDestinations, type NormalizedDestination } from '@/lib/trip-destination-normalize';
import type { PlaceCandidate } from '@/lib/ai-generate-itinerary';

export type DnaPlace = PlaceCandidate & { tip?: string };

export type DnaProposalInput = {
  clientName: string;
  destinations: string[];
  startDate: string;
  durationDays: number;
  /** Lodging request: trip-form choices (boutique, star4 …) + DNA free text. */
  hotelPreference: string;
  flightSeat: string;
  dnaInterests: string[];
  /** calm | medium | active (or Arabic). */
  pace?: string;
  dayStart?: string;
  hotelBank: QuotationHotelPlace[];
  /** Places per normalized destination key (exact city match from the bank). */
  placesByDestination: Record<string, DnaPlace[]>;
  /** Optional nights per destination key (keeps an expert's split when rebuilding). */
  nightsByDestination?: Record<string, number>;
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
  citiesWithoutPlaces: string[];
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
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short', calendar: 'gregory', timeZone: 'UTC' }).format(date);
  } catch {
    return iso;
  }
}

/**
 * Spread the trip days over the cities: bigger banks (more to do) get more days, every city gets at
 * least one, and an explicit split (from the expert) always wins.
 */
export function allocateCityNights(
  destinations: NormalizedDestination[],
  durationDays: number,
  placeCounts: Record<string, number> = {},
  explicit: Record<string, number> = {},
): Array<{ dest: NormalizedDestination; nights: number }> {
  const days = Math.max(1, Math.trunc(durationDays) || 1);
  if (!destinations.length) return [];
  const list = destinations.slice(0, days);
  const fixed = list.map((d) => Math.max(0, Math.trunc(explicit[d.key] ?? 0)));
  const fixedSum = fixed.reduce((a, b) => a + b, 0);
  if (fixedSum === days && fixed.every((n) => n > 0)) return list.map((dest, i) => ({ dest, nights: fixed[i]! }));

  const weights = list.map((d) => 1 + Math.sqrt(Math.max(0, placeCounts[d.key] ?? 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  const extra = days - list.length; // after 1 day each
  const raw = weights.map((w) => (w / total) * extra);
  const nights = raw.map((r) => 1 + Math.floor(r));
  let left = days - nights.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    nights[i]! += 1;
    left -= 1;
  }
  return list.map((dest, i) => ({ dest, nights: nights[i]! }));
}

function stopsPerDayForPace(pace: string): number {
  const p = String(pace ?? '').toLowerCase();
  if (/calm|هادئ|low|خفيف/.test(p)) return 3;
  if (/active|نشيط|high/.test(p)) return 5;
  return 4;
}

function timesFor(dayStart: string, count: number): string[] {
  const s = String(dayStart ?? '').toLowerCase();
  const start = /early|مبكر/.test(s) ? 8.5 : /late|متأخر/.test(s) ? 11 : 9.5;
  const gaps = count <= 3 ? [0, 3.5, 7.5] : count === 4 ? [0, 2.5, 5.5, 9] : [0, 2, 4.5, 7, 9.5];
  return gaps.slice(0, count).map((g) => {
    const h = start + g;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  });
}

function placeText(p: DnaPlace): string {
  return `${p.name} ${p.name_en ?? ''} ${p.sub_tag ?? ''} ${p.tip ?? ''}`.toLowerCase();
}

function themeScore(p: DnaPlace, theme: DayTheme): number {
  const text = placeText(p);
  let s = 0;
  for (const k of theme.keywords) if (text.includes(k.toLowerCase())) s += 3;
  if (theme.categories.includes(String(p.category ?? ''))) s += 1;
  if (p.tip) s += 0.5;
  return s;
}

/** Day plan: themed picks + one meal slot when the bank has food in this city. */
function pickDayPlaces(pool: DnaPlace[], used: Set<string>, themes: DayTheme[], count: number): DnaPlace[] {
  const free = pool.filter((p) => !used.has(p.id) && String(p.category ?? '') !== 'h');
  const primary = themes[0]!;
  const ranked = [...free].sort((a, b) => themeScore(b, primary) + 0.5 * themeScore(b, themes[1] ?? primary) - (themeScore(a, primary) + 0.5 * themeScore(a, themes[1] ?? primary)));
  const picks: DnaPlace[] = [];
  const catCount = new Map<string, number>();
  const take = (p: DnaPlace | undefined) => {
    if (!p || picks.includes(p) || picks.length >= count) return;
    picks.push(p);
    used.add(p.id);
    catCount.set(String(p.category), (catCount.get(String(p.category)) ?? 0) + 1);
  };
  // keep one slot for a café/restaurant
  const mealSlots = count >= 4 ? 1 : 0;
  for (const p of ranked) {
    if (picks.length >= count - mealSlots) break;
    const c = String(p.category ?? '');
    if ((c === 'r' || c === 'c') && mealSlots) continue;
    if ((catCount.get(c) ?? 0) >= 2) continue; // variety
    take(p);
  }
  if (mealSlots) take(ranked.find((p) => p.category === 'r' && !picks.includes(p)) ?? ranked.find((p) => p.category === 'c' && !picks.includes(p)));
  for (const p of ranked) take(p);
  // order: café first, restaurant last, the rest in between
  const rank = (p: DnaPlace) => (p.category === 'c' ? 0 : p.category === 'r' ? 2 : 1);
  return picks.sort((a, b) => rank(a) - rank(b));
}

export function buildDnaItineraryDays(params: {
  allocation: Array<{ dest: NormalizedDestination; nights: number }>;
  startDate: string;
  interests: string[];
  pace?: string;
  dayStart?: string;
  placesByDestination: Record<string, DnaPlace[]>;
}): { days: QuotationItineraryDay[]; citiesWithoutPlaces: string[] } {
  const themes = themesForInterests(params.interests);
  const perDay = stopsPerDayForPace(params.pace ?? '');
  const days: QuotationItineraryDay[] = [];
  const citiesWithoutPlaces: string[] = [];
  const used = new Set<string>();
  const totalDays = params.allocation.reduce((n, a) => n + a.nights, 0);
  let dayNumber = 1;
  let themeCursor = 0;

  params.allocation.forEach(({ dest, nights }, segIndex) => {
    const pool = params.placesByDestination[dest.key] ?? [];
    if (!pool.length) citiesWithoutPlaces.push(dest.label);
    for (let n = 0; n < nights; n += 1) {
      const isFirst = dayNumber === 1;
      const isLast = dayNumber === totalDays;
      const isArrivalInCity = n === 0 && segIndex > 0;
      const dayThemes = [themes[themeCursor % themes.length]!, themes[(themeCursor + 1) % themes.length]!];
      themeCursor += 1;
      const count = isFirst || isLast || isArrivalInCity ? Math.max(2, perDay - 1) : perDay;
      const picks = pool.length ? pickDayPlaces(pool, used, dayThemes, count) : [];
      const times = timesFor(params.dayStart ?? '', picks.length);
      const stops: QuotationItineraryStop[] = picks.map((place, i) => ({
        ...createEmptyItineraryStop(),
        time: times[i] ?? '12:00',
        title: sensoryStopTitle(String(place.category ?? 'o'), dayThemes[0]!, i),
        category: String(place.category ?? 'o'),
        // tips can mention the venue — keep them only when they don't reveal the name
        notes: place.tip && !place.tip.toLowerCase().includes(place.name.toLowerCase()) ? place.tip : '',
        search_keyword: place.name_en || place.name,
        place_id: place.id,
        place_real_name: place.name,
      }));

      const theme = dayThemes[0]!;
      let title = theme.title(dest.label);
      let description = theme.pitch(dest.label);
      if (isFirst) {
        title = `أهلاً بك في ${dest.label}`;
        description = `يوم الوصول على مهل: تستقر في فندقك، ثم أول نزهة خفيفة تعرّفك على ${dest.label} وأجوائها${themes[0] ? `، بلمسة من ${themes[0].label}` : ''}.`;
      } else if (isArrivalInCity) {
        title = `الانتقال إلى ${dest.label}`;
        description = `رحلة مريحة إلى ${dest.label}، ثم بداية هادئة تكتشف فيها روح المدينة الجديدة قبل أيامها القادمة.`;
      } else if (isLast) {
        title = `وداعاً ${dest.label}`;
        description = `يوم أخير خفيف: آخر لحظاتك المفضلة في ${dest.label} وتسوّق الهدايا، ثم توديع على مهل قبل رحلة العودة.`;
      } else if (!pool.length) {
        description = `${theme.pitch(dest.label)} يكتمل تفصيل محطات هذا اليوم مع خبيرك.`;
      }

      days.push({
        ...createEmptyItineraryDay(dayNumber),
        dayNumber,
        date: params.startDate ? addDaysIso(params.startDate, dayNumber - 1) : '',
        city: dest.label,
        title,
        description,
        stops,
      });
      dayNumber += 1;
    }
  });

  return { days, citiesWithoutPlaces };
}

export function buildDnaActivityOptions(params: {
  placesByDestination: Record<string, DnaPlace[]>;
  allocation: Array<{ dest: NormalizedDestination; nights: number }>;
  interests: string[];
  usedPlaceIds: Set<string>;
  limit?: number;
}): QuotationActivityOption[] {
  const limit = Math.max(1, params.limit ?? 6);
  const themes = themesForInterests(params.interests);
  const options: QuotationActivityOption[] = [];
  for (const { dest } of params.allocation) {
    const pool = (params.placesByDestination[dest.key] ?? []).filter(
      (p) => !params.usedPlaceIds.has(p.id) && ['d', 'o', 'f'].includes(String(p.category ?? '')),
    );
    for (const theme of themes) {
      if (options.length >= limit) break;
      const best = [...pool].sort((a, b) => themeScore(b, theme) - themeScore(a, theme))[0];
      if (!best || themeScore(best, theme) < 3) continue;
      params.usedPlaceIds.add(best.id);
      options.push({
        ...createEmptyActivityOption(),
        name: `${theme.label} في ${dest.label}`,
        description: `تجربة اختيارية تضيفها لبرنامجك، مختارة لأنك تحب ${theme.label}.`,
        price: 0,
        is_selected_by_client: false,
      });
    }
  }
  return options.length ? options : [{ ...createEmptyActivityOption() }];
}

/** Map DNA seat preference → flight class label. */
export function flightClassFromDnaSeat(seatRaw: string): string {
  const s = String(seatRaw ?? '').trim().toLowerCase();
  if (!s) return 'رجال أعمال';
  if (/first|أولى|اولى|f\b/.test(s)) return 'درجة أولى';
  if (/business|رجال|أعمال|اعمال|جوهرة|jewel/.test(s)) return 'رجال أعمال';
  if (/premium|مميزة|بريميوم/.test(s)) return 'اقتصادية مميزة';
  if (/economy|اقتصاد|سياح/.test(s)) return 'اقتصادية';
  return 'رجال أعمال';
}

export function buildDnaFlightProposals(params: {
  firstCity: string;
  lastCity: string;
  startDate: string;
  endDate: string;
  flightSeat: string;
}): QuotationFlightProposal[] {
  const flightClass = flightClassFromDnaSeat(params.flightSeat);
  const startLabel = formatArDate(params.startDate) || params.startDate;
  const endLabel = formatArDate(params.endDate) || params.endDate;
  return [
    { ...createEmptyFlightProposal(), departureCity: 'الرياض', arrivalCity: params.firstCity, airline: `ذهاب · ${startLabel}`, flight_class: flightClass, price: 0 },
    { ...createEmptyFlightProposal(), departureCity: params.lastCity, arrivalCity: 'الرياض', airline: `عودة · ${endLabel}`, flight_class: flightClass, price: 0 },
  ];
}

/** Full tailor-made draft from DNA + trip window. */
export function buildDnaProposalDraft(input: DnaProposalInput): DnaProposalDraft {
  const dests = normalizeDestinations(input.destinations);
  const durationDays = Math.max(1, Math.trunc(input.durationDays) || 1);
  const startDate = String(input.startDate ?? '').trim().slice(0, 10);
  const endDate = startDate ? addDaysIso(startDate, durationDays - 1) : '';
  const interests = (input.dnaInterests ?? []).map((x) => String(x).trim()).filter(Boolean);
  const placeCounts = Object.fromEntries(Object.entries(input.placesByDestination).map(([k, v]) => [k, v.length]));
  const allocation = allocateCityNights(dests, durationDays, placeCounts, input.nightsByDestination ?? {});

  const { days: itineraryDays, citiesWithoutPlaces } = buildDnaItineraryDays({
    allocation,
    startDate,
    interests,
    pace: input.pace,
    dayStart: input.dayStart,
    placesByDestination: input.placesByDestination,
  });

  const hotelMatch = buildDnaHotelOptions({
    itineraryDays,
    hotelBank: input.hotelBank ?? [],
    hotelPreference: input.hotelPreference ?? '',
    startDate,
    perCity: 2,
  });

  const used = new Set(itineraryDays.flatMap((d) => d.stops.map((s) => s.place_id).filter(Boolean) as string[]));
  const activityOptions = buildDnaActivityOptions({ placesByDestination: input.placesByDestination, allocation, interests, usedPlaceIds: used, limit: 6 });

  const labels = dests.map((d) => d.label);
  const country = dests.find((d) => d.countryLabel)?.countryLabel ?? '';
  const sameCountry = dests.length > 0 && dests.every((d) => d.countryId && d.countryId === dests[0]!.countryId);
  const title = sameCountry && country ? `رحلة ${country}: ${labels.join(' · ')}` : `رحلة ${labels.join(' · ') || 'مخصّصة'}`;

  return {
    title,
    destinations: labels,
    startDate,
    endDate,
    itineraryDays,
    hotelOptions: hotelMatch.options.length ? hotelMatch.options : [createEmptyHotelOption()],
    activityOptions,
    transportOptions: [
      {
        ...createEmptyTransportOption(),
        name: 'سيارة خاصة مع سائق',
        description: 'تنقّل خاص ومريح طوال أيام الرحلة',
        price: 0,
        is_selected_by_client: false,
      },
    ],
    flightProposals: buildDnaFlightProposals({
      firstCity: labels[0] || 'الوجهة',
      lastCity: labels[labels.length - 1] || labels[0] || 'الوجهة',
      startDate,
      endDate,
      flightSeat: input.flightSeat ?? '',
    }),
    citiesMatchedHotels: hotelMatch.citiesMatched,
    citiesWithoutHotels: hotelMatch.citiesWithoutHotels,
    citiesWithoutPlaces,
    stopsFilled: itineraryDays.reduce((n, d) => n + (d.stops?.length ?? 0), 0),
  };
}
