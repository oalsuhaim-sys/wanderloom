/**
 * Claude AI full-proposal prompt + JSON parsers.
 * Shape: itinerary days, recommended_hotels, flight_summary.
 */

import {
  extractJsonObject,
  parseGeneratedItineraryPayload,
  type GeneratedItineraryDay,
  type PlaceCandidate,
} from '@/lib/ai-generate-itinerary';
import {
  createEmptyActivityOption,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyItineraryStop,
  createEmptyTransportOption,
  type QuotationActivityOption,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import {
  createEmptyFlightProposal,
  findQuotationHotelPlace,
  type QuotationFlightProposal,
  type QuotationHotelPlace,
} from '@/lib/crm-quotations';
import { addDaysIso, flightClassFromDnaSeat } from '@/lib/dna-proposal-generator';
import { buildDnaHotelOptions } from '@/lib/dna-hotel-match';

export type GenerateProposalAiRequest = {
  clientName: string;
  destinations: string[];
  travelDate: string;
  endDate: string;
  durationDays: number;
  passengersCount: number | null;
  hotelPreference: string;
  flightSeat: string;
  dnaInterests: string[];
  dnaActivityLevel?: string;
  dnaSpecialRequests?: string;
  foodAllergies?: string;
  favoriteDrink?: string;
  hotelBankPreview?: Array<{ name: string; city: string; category: string }>;
  placeCandidates?: PlaceCandidate[];
};

export type ClaudeRecommendedHotel = {
  city: string;
  name: string;
  description: string;
  checkIn: string;
  checkOut: string;
  tier: string;
};

export type ClaudeFlightLeg = {
  direction: 'outbound' | 'return' | string;
  departureCity: string;
  arrivalCity: string;
  date: string;
  airline: string;
  flightClass: string;
  notes: string;
};

export type ClaudeProposalPayload = {
  itinerary: GeneratedItineraryDay[];
  recommendedHotels: ClaudeRecommendedHotel[];
  flightSummary: ClaudeFlightLeg[];
  titleHint: string;
  summary: string;
};

export const WANDERLOOM_PROPOSAL_ENGINEER_SYSTEM = `You are Wanderloom's Senior Proposal Architect for VIP Saudi/Gulf travelers.

CRITICAL OUTPUT RULE:
Respond ONLY with valid, raw JSON (no markdown fences, no explanatory text, no preamble, no trailing commentary).
Never wrap the JSON in \`\`\`json or \`\`\` fences.
Schema (keys required):
{
  "title": "",
  "summary": "",
  "itinerary": [],
  "recommended_hotels": [],
  "flight_summary": []
}

Signature daily rhythm — Wanderloom Standard flow (prefer ALL eight beats when days ≤ 5; for longer trips use 4–6 strong stops per day):
1. الصحوة (Lodging / Wakeup)
2. الإفطار (Bespoke Breakfast)
3. الشارع المميز (Signature Street Walk)
4. القهوة المختصة (Specialty Coffee)
5. المعلم الأساسي (Highlight Attraction)
6. تجربة خاصة (Immersive Private Experience)
7. المنطقة الليلية (Evening District)
8. العشاء (Gourmet Dining)

Rules:
- Output MUST be a single valid JSON object only.
- Tailor EVERY day/activity to the client's DNA interests and hotel tier.
- itinerary stop titles + notes in elegant Arabic (sensory). Prefer quiet VIP venues.
- category codes ONLY: h, c, r, s, l, d, f, o.
- Times as HH:MM (24h).
- Hotel suggestions MUST match the DNA hotel style (luxury / boutique / smart-economy / family) and stay dates inside the travel window.
- Flight schedule MUST align with travel_date (outbound) and trip end (return).
- When a hotel bank list is provided, prefer those exact hotel names for the matching city/tier.
- When place candidates are provided, set place_id to an exact candidate id when it fits; never invent ids.
- Keep strings concise so the full JSON fits without truncation.

Exact JSON shape:
{
  "title": "string Arabic trip title",
  "summary": "short Arabic proposal summary",
  "itinerary": [
    {
      "dayNumber": 1,
      "title": "string",
      "city": "string",
      "stops": [
        {
          "title": "sensory Arabic title",
          "time": "HH:MM",
          "notes": "sensory Arabic notes",
          "category": "c",
          "search_keyword": "english search phrase",
          "place_id": "exact candidate id or empty string"
        }
      ]
    }
  ],
  "recommended_hotels": [
    {
      "city": "string",
      "name": "string",
      "description": "nights · tier · Arabic date range",
      "check_in": "YYYY-MM-DD",
      "check_out": "YYYY-MM-DD",
      "tier": "فاخر|بوتيك|اقتصادي ذكي|عائلي"
    }
  ],
  "flight_summary": [
    {
      "direction": "outbound",
      "departure_city": "الرياض",
      "arrival_city": "string",
      "date": "YYYY-MM-DD",
      "airline": "string or suggested carrier",
      "flight_class": "رجال أعمال|درجة أولى|اقتصادية مميزة|اقتصادية",
      "notes": "short Arabic note"
    }
  ]
}`;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function formatHotelBankPreview(
  hotels: Array<{ name: string; city: string; category: string }>,
): string {
  if (!hotels.length) return 'none — invent sensible VIP hotel names matching DNA tier';
  return hotels
    .slice(0, 60)
    .map((h) => `- ${h.name} | ${h.city} | ${h.category}`)
    .join('\n');
}

function formatPlaceCandidates(candidates: PlaceCandidate[]): string {
  if (!candidates.length) return 'none — use search_keyword for every stop';
  return candidates
    .slice(0, 48)
    .map((c) => {
      const label = [c.name, c.name_en].filter(Boolean).join(' / ');
      const meta = [c.category, c.sub_tag, c.city].filter(Boolean).join(' · ');
      return `- id=${c.id} | ${label} | ${meta}`;
    })
    .join('\n');
}

export function buildGenerateProposalUserPrompt(input: GenerateProposalAiRequest): string {
  const days = Math.min(14, Math.max(1, Math.trunc(Number(input.durationDays) || 1)));
  const dests = (input.destinations ?? []).map((d) => d.trim()).filter(Boolean);
  const stopsHint =
    days > 5
      ? 'Each day: 4–6 concise stops (not the full 8) to keep JSON compact and complete.'
      : 'Each day: ALL 8 Wanderloom Standard stops, concise Arabic notes.';
  return [
    `Client name: ${input.clientName.trim() || 'VIP Client'}`,
    `Destinations (in order): ${dests.join(' → ') || 'TBD'}`,
    `Travel date (outbound): ${input.travelDate || '?'}`,
    `End date (return): ${input.endDate || '?'}`,
    `Duration days: ${days}`,
    `Passengers: ${input.passengersCount ?? 'unspecified'}`,
    `DNA interests: ${input.dnaInterests.filter(Boolean).join(', ') || 'not specified'}`,
    `DNA hotel style / tier: ${input.hotelPreference.trim() || 'luxury default'}`,
    `DNA flight seat / class: ${input.flightSeat.trim() || 'business preferred'}`,
    `DNA activity level: ${String(input.dnaActivityLevel ?? '').trim() || 'n/a'}`,
    `Dietary / allergies: ${String(input.foodAllergies ?? '').trim() || 'n/a'}`,
    `Favorite drink / coffee: ${String(input.favoriteDrink ?? '').trim() || 'n/a'}`,
    `VIP secret notes: ${String(input.dnaSpecialRequests ?? '').trim() || 'n/a'}`,
    '',
    'Hotel bank (prefer these names when city + DNA tier fit):',
    formatHotelBankPreview(input.hotelBankPreview ?? []),
    '',
    'Real place candidates (set place_id to exact id when suitable):',
    formatPlaceCandidates(input.placeCandidates ?? []),
    '',
    `Generate exactly ${days} itinerary day(s) covering the destinations in a sensible city sequence.`,
    stopsHint,
    'recommended_hotels: at least 2 options per city occupied in the itinerary, with check_in/check_out inside the travel window.',
    'flight_summary: exactly 2 legs — outbound on travel_date and return on end date (الرياض as default Saudi origin unless DNA implies otherwise).',
    'Respond ONLY with valid, raw JSON (no markdown fences, no explanatory text). Schema: { "title": "", "summary": "", "itinerary": [...], "recommended_hotels": [...], "flight_summary": [...] }',
  ].join('\n');
}

function parseRecommendedHotels(raw: unknown, startDate: string): ClaudeRecommendedHotel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      const name = String(row.name ?? row.hotel_name ?? '').trim();
      if (!name) return null;
      const checkIn = String(row.check_in ?? row.checkIn ?? startDate).trim().slice(0, 10);
      const checkOut = String(row.check_out ?? row.checkOut ?? '').trim().slice(0, 10);
      return {
        city: String(row.city ?? '').trim(),
        name,
        description: String(row.description ?? row.notes ?? '').trim(),
        checkIn,
        checkOut,
        tier: String(row.tier ?? row.style ?? row.category ?? '').trim(),
      } satisfies ClaudeRecommendedHotel;
    })
    .filter((x): x is ClaudeRecommendedHotel => x != null);
}

function parseFlightSummary(raw: unknown): ClaudeFlightLeg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item);
      const departureCity = String(
        row.departure_city ?? row.departureCity ?? row.from ?? '',
      ).trim();
      const arrivalCity = String(row.arrival_city ?? row.arrivalCity ?? row.to ?? '').trim();
      if (!departureCity && !arrivalCity) return null;
      return {
        direction: String(row.direction ?? '').trim() || 'leg',
        departureCity,
        arrivalCity,
        date: String(row.date ?? '').trim().slice(0, 10),
        airline: String(row.airline ?? row.carrier ?? '').trim(),
        flightClass: String(row.flight_class ?? row.flightClass ?? row.class ?? '').trim(),
        notes: String(row.notes ?? row.description ?? '').trim(),
      } satisfies ClaudeFlightLeg;
    })
    .filter((x): x is ClaudeFlightLeg => x != null);
}

export function parseClaudeProposalPayload(
  payload: unknown,
  opts?: { startDate?: string },
): ClaudeProposalPayload {
  const root = asRecord(payload);
  const itineraryRaw =
    root.itinerary ?? root.days ?? root.itinerary_days ?? payload;
  const itinerary = parseGeneratedItineraryPayload(
    Array.isArray(itineraryRaw) ? { days: itineraryRaw } : itineraryRaw,
  );
  const hotels = parseRecommendedHotels(
    root.recommended_hotels ?? root.recommendedHotels ?? root.hotels,
    opts?.startDate ?? '',
  );
  const flights = parseFlightSummary(
    root.flight_summary ?? root.flightSummary ?? root.flights,
  );
  return {
    itinerary,
    recommendedHotels: hotels,
    flightSummary: flights,
    titleHint: String(root.title ?? root.trip_title ?? '').trim(),
    summary: String(root.summary ?? root.overview ?? '').trim(),
  };
}

/** Strip markdown fences then parse — primary path for Claude proposal replies. */
export function stripClaudeMarkdownFences(text: string): string {
  return String(text ?? '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

export function extractClaudeProposalFromText(
  text: string,
  opts?: { startDate?: string },
): ClaudeProposalPayload {
  const cleaned = stripClaudeMarkdownFences(text);
  // Prefer shared robust extractor (handles truncation + fences)
  let parsed = extractJsonObject(cleaned);
  if (!parsed || (typeof parsed === 'object' && !Array.isArray(parsed) && !Object.keys(parsed as object).length)) {
    // Fallback: direct JSON.parse on fence-stripped text
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }
  }
  return parseClaudeProposalPayload(parsed, opts);
}

/** Stamp calendar dates onto Claude days from trip start. */
export function stampItineraryDates(
  days: GeneratedItineraryDay[],
  startDate: string,
): QuotationItineraryDay[] {
  return days.map((day, idx) => {
    const base = createEmptyItineraryDay(day.dayNumber || idx + 1);
    const date = startDate ? addDaysIso(startDate, idx) : '';
    const stops = (day.stops ?? []).map((stop) => ({
      ...createEmptyItineraryStop(),
      time: stop.time,
      title: stop.title,
      category: stop.category || 'o',
      notes: stop.notes,
      search_keyword: stop.search_keyword,
      image_url: stop.image_url?.trim() || '',
      ...(stop.place_id ? { place_id: stop.place_id } : {}),
      ...(stop.place_real_name ? { place_real_name: stop.place_real_name } : {}),
    }));
    return {
      ...base,
      dayNumber: day.dayNumber || idx + 1,
      date,
      city: day.city,
      title: day.title || `اليوم ${idx + 1}`,
      description: 'مسار مولَّد بواسطة Claude AI حسب DNA العميل',
      stops,
    };
  });
}

export function mapClaudeHotelsToOptions(
  hotels: ClaudeRecommendedHotel[],
  hotelBank: QuotationHotelPlace[],
): QuotationHotelOption[] {
  const options: QuotationHotelOption[] = [];
  for (const h of hotels) {
    const bankHit = findQuotationHotelPlace(hotelBank, h.name, h.city);
    const name = bankHit?.name || h.name;
    const city = bankHit?.city || h.city;
    const dateRange =
      h.checkIn && h.checkOut ? ` · ${h.checkIn} → ${h.checkOut}` : '';
    const tier = h.tier || bankHit?.category || '';
    options.push({
      ...createEmptyHotelOption(),
      city,
      name,
      description:
        h.description ||
        `${tier}${dateRange}`.trim() ||
        'مقترح Claude حسب DNA',
      price: 0,
      is_selected_by_client: false,
    });
  }
  return options;
}

export function mapClaudeFlightsToProposals(
  flights: ClaudeFlightLeg[],
  fallback: {
    destinations: string[];
    startDate: string;
    endDate: string;
    flightSeat: string;
  },
): QuotationFlightProposal[] {
  if (flights.length) {
    return flights.map((leg) => {
      const dateLabel = leg.date || '';
      const dirLabel =
        leg.direction === 'outbound' || /ذهاب|out/i.test(leg.direction)
          ? 'ذهاب'
          : leg.direction === 'return' || /عودة|ret/i.test(leg.direction)
            ? 'عودة'
            : leg.direction;
      return {
        ...createEmptyFlightProposal(),
        departureCity: leg.departureCity,
        arrivalCity: leg.arrivalCity,
        airline: [leg.airline || dirLabel, dateLabel, leg.notes].filter(Boolean).join(' · '),
        flight_class:
          leg.flightClass || flightClassFromDnaSeat(fallback.flightSeat),
        price: 0,
      };
    });
  }

  const first = fallback.destinations[0] || 'الوجهة';
  const last = fallback.destinations[fallback.destinations.length - 1] || first;
  const cls = flightClassFromDnaSeat(fallback.flightSeat);
  return [
    {
      ...createEmptyFlightProposal(),
      departureCity: 'الرياض',
      arrivalCity: first,
      airline: `ذهاب · ${fallback.startDate}`,
      flight_class: cls,
      price: 0,
    },
    {
      ...createEmptyFlightProposal(),
      departureCity: last,
      arrivalCity: 'الرياض',
      airline: `عودة · ${fallback.endDate}`,
      flight_class: cls,
      price: 0,
    },
  ];
}

export function buildActivityOptionsFromItinerary(
  days: QuotationItineraryDay[],
  interests: string[],
): QuotationActivityOption[] {
  const interestLabel = interests.slice(0, 3).join(' · ') || 'اهتمامات DNA';
  const seen = new Set<string>();
  const options: QuotationActivityOption[] = [];
  for (const day of days) {
    for (const stop of day.stops ?? []) {
      if (options.length >= 6) break;
      const cat = stop.category;
      if (cat !== 'd' && cat !== 'l' && cat !== 'f') continue;
      const key = stop.title.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      options.push({
        ...createEmptyActivityOption(),
        name: stop.title,
        description: `${day.city ? `${day.city} · ` : ''}${interestLabel}`,
        price: 0,
        is_selected_by_client: false,
      });
    }
  }
  if (!options.length) return [createEmptyActivityOption()];
  return options;
}

/**
 * Merge Claude payload into a quotation-ready draft.
 * Falls back to DNA hotel matcher when Claude hotels are empty.
 */
export function mergeClaudeProposalIntoDraft(params: {
  clientName: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  hotelPreference: string;
  flightSeat: string;
  dnaInterests: string[];
  claude: ClaudeProposalPayload;
  hotelBank: QuotationHotelPlace[];
}): {
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  itineraryDays: QuotationItineraryDay[];
  hotelOptions: QuotationHotelOption[];
  activityOptions: QuotationActivityOption[];
  transportOptions: QuotationTransportOption[];
  flightProposals: QuotationFlightProposal[];
  stopsFilled: number;
} {
  const itineraryDays = stampItineraryDates(
    params.claude.itinerary,
    params.startDate,
  );

  let hotelOptions = mapClaudeHotelsToOptions(
    params.claude.recommendedHotels,
    params.hotelBank,
  );
  if (!hotelOptions.length && itineraryDays.length) {
    const matched = buildDnaHotelOptions({
      itineraryDays,
      hotelBank: params.hotelBank,
      hotelPreference: params.hotelPreference,
      startDate: params.startDate,
    });
    hotelOptions = matched.options;
  }
  if (!hotelOptions.length) hotelOptions = [createEmptyHotelOption()];

  const flightProposals = mapClaudeFlightsToProposals(params.claude.flightSummary, {
    destinations: params.destinations,
    startDate: params.startDate,
    endDate: params.endDate,
    flightSeat: params.flightSeat,
  });

  const destLabel =
    params.destinations.filter(Boolean).join(' · ') ||
    itineraryDays.map((d) => d.city).filter(Boolean)[0] ||
    'رحلة';
  const title =
    params.claude.titleHint ||
    `عرض Claude AI · ${params.clientName} · ${destLabel}`;

  return {
    title,
    destinations: params.destinations.length
      ? params.destinations
      : [...new Set(itineraryDays.map((d) => d.city).filter(Boolean))],
    startDate: params.startDate,
    endDate: params.endDate,
    itineraryDays: itineraryDays.length
      ? itineraryDays
      : [createEmptyItineraryDay(1)],
    hotelOptions,
    activityOptions: buildActivityOptionsFromItinerary(
      itineraryDays,
      params.dnaInterests,
    ),
    transportOptions: [
      {
        ...createEmptyTransportOption(),
        name: 'سيارة خاصة VIP',
        description: 'نقل فاخر — مقترح مع عرض Claude',
        price: 0,
        is_selected_by_client: false,
      },
    ],
    flightProposals,
    stopsFilled: itineraryDays.reduce((n, d) => n + (d.stops?.length ?? 0), 0),
  };
}
