import type { ExperienceRow } from '@/types/experience';
import type { HotelRow } from '@/types/hotel';

export type HotelTier = 'economy' | 'standard' | 'luxury';

export type AlternativeHotel = {
  id: string;
  hotel: HotelRow;
  tier: HotelTier;
};

/** محطة ضمن يوم — story/description و transport_type/taxi للمخطط */
export type ItineraryStopDraft = {
  id: string;
  place_name: string;
  time_slot: string;
  note: string;
  story: string;
  transport_type: string;
  lat: string;
  lng: string;
  category: string;
};

export type ItineraryDayDraft = {
  id: string;
  title: string;
  city: string;
  notes: string;
  stops: ItineraryStopDraft[];
  hotel: HotelRow | null;
  alternative_hotels: AlternativeHotel[];
  experience: ExperienceRow | null;
};

export type FlightDetailsDraft = {
  from_city: string;
  to_city: string;
  destination_flag: string;
  flight_number: string;
  airport: string;
  terminal: string;
  leave_home_time: string;
};

export type BudgetOptionsDraft = {
  economy: string;
  standard: string;
  luxury: string;
  currency: string;
};

export type BudgetTrackingDraft = {
  totalPrice: string;
  totalBudget: string;
  spentAmount: string;
};

export type DiscoverDraft = {
  destinationStory: string;
  taxiPhrase: string;
  secretGem: string;
};

export type LocalLingoDraft = {
  id: string;
  arabic_word: string;
  local_word: string;
};

export type ItineraryDraft = {
  customerName: string;
  title: string;
  datesFrom: string;
  datesTo: string;
  passcode: string;
  destination: string;
  flight: FlightDetailsDraft;
  weatherTemp: string;
  highlights: string[];
  budgetOptions: BudgetOptionsDraft;
  budgetTracking: BudgetTrackingDraft;
  discover: DiscoverDraft;
  localLingo: LocalLingoDraft[];
  days: ItineraryDayDraft[];
  tripMode: 'Individual' | 'Group';
  groupName: string;
  linkedClientId: string;
  groupMemberIds: number[];
  includeWardrobe: boolean;
  unlockSecretGuide: boolean;
};

export type BudgetOptionsPayload = {
  economic?: number | null;
  standard?: number | null;
  luxury?: number | null;
  economy_total?: number | null;
  standard_total?: number | null;
  luxury_total?: number | null;
  currency?: string | null;
};

const DAY_LABELS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dayLabel(index: number): string {
  return DAY_LABELS[index] ?? `${index + 1}`;
}

export function createEmptyStop(): ItineraryStopDraft {
  return {
    id: newLocalId(),
    place_name: '',
    time_slot: '',
    note: '',
    story: '',
    transport_type: '',
    lat: '',
    lng: '',
    category: 'o',
  };
}

export function createEmptyDay(index: number): ItineraryDayDraft {
  return {
    id: `day-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title: `اليوم ${dayLabel(index)}`,
    city: '',
    notes: '',
    stops: [createEmptyStop()],
    hotel: null,
    alternative_hotels: [],
    experience: null,
  };
}

export function createInitialItineraryDraft(): ItineraryDraft {
  return {
    customerName: '',
    title: '',
    datesFrom: '',
    datesTo: '',
    passcode: '',
    destination: '',
    flight: {
      from_city: '',
      to_city: '',
      destination_flag: '',
      flight_number: '',
      airport: '',
      terminal: '',
      leave_home_time: '',
    },
    weatherTemp: '',
    highlights: [],
    budgetOptions: { economy: '', standard: '', luxury: '', currency: 'SAR' },
    budgetTracking: { totalPrice: '', totalBudget: '', spentAmount: '' },
    discover: { destinationStory: '', taxiPhrase: '', secretGem: '' },
    localLingo: [],
    days: [createEmptyDay(0)],
    tripMode: 'Individual',
    groupName: '',
    linkedClientId: '',
    groupMemberIds: [],
    includeWardrobe: false,
    unlockSecretGuide: false,
  };
}

export function normalizeTier(t: unknown): HotelTier {
  const s = String(t ?? '').toLowerCase();
  if (s === 'economy' || s === 'economic') return 'economy';
  if (s === 'luxury' || s === 'lux') return 'luxury';
  return 'standard';
}

function parseOptionalPositiveNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseBudgetAmountForSave(raw: string): number {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (!s) return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function parseCoord(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function serializeHotelSnapshot(h: HotelRow | null) {
  if (!h) return null;
  return {
    id: h.id,
    name: h.name,
    country: h.country,
    city: h.city,
    booking_url: h.booking_url,
  };
}

function serializeExperienceSnapshot(e: ExperienceRow | null) {
  if (!e) return null;
  return {
    id: e.id,
    title: e.title,
    country: e.country,
    city: e.city,
    detail_url: e.detail_url,
  };
}

export function buildStopsForSave(stops: ItineraryStopDraft[]) {
  return stops
    .map((s, index) => {
      const place_name = s.place_name.trim();
      const story = s.story.trim();
      const note = s.note.trim();
      const transport = s.transport_type.trim();
      if (!place_name && !note && !story) return null;

      const lat = parseCoord(s.lat);
      const lng = parseCoord(s.lng);

      return {
        sort_order: index + 1,
        place_name: place_name || 'محطة',
        time_slot: s.time_slot.trim() || undefined,
        note: note || story || undefined,
        story: story || undefined,
        description: story || undefined,
        transport_type: transport || undefined,
        taxi: transport || undefined,
        category: s.category.trim() || 'o',
        ...(lat != null ? { lat, latitude: lat } : {}),
        ...(lng != null ? { lng, longitude: lng } : {}),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export function buildDaysDataForSave(days: ItineraryDayDraft[]) {
  return days.map((d, idx) => {
    const stops = buildStopsForSave(d.stops);
    return {
      day_number: idx + 1,
      title: d.title,
      city: d.city.trim() || undefined,
      notes: d.notes,
      stops,
      itinerary_stops: stops,
      hotel: serializeHotelSnapshot(d.hotel),
      alternative_hotels: d.alternative_hotels.map((a) => ({
        id: a.id,
        tier: a.tier,
        hotel: serializeHotelSnapshot(a.hotel),
      })),
      experience: serializeExperienceSnapshot(d.experience),
    };
  });
}

export function deriveHotelDetailsFromDays(days: ItineraryDayDraft[]) {
  const seen = new Set<string>();
  const rows: { name: string; thumbnail_url?: string; image_url?: string }[] = [];

  const pushHotel = (h: HotelRow | null) => {
    if (!h?.name?.trim()) return;
    const key = String(h.id ?? h.name);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      name: h.name.trim(),
      thumbnail_url: undefined,
      image_url: undefined,
    });
  };

  for (const d of days) {
    pushHotel(d.hotel);
    for (const alt of d.alternative_hotels) pushHotel(alt.hotel);
  }
  return rows;
}

export function deriveExperiencesDetailsFromDays(days: ItineraryDayDraft[]) {
  const seen = new Set<string>();
  const rows: { name: string; icon?: string }[] = [];

  for (const d of days) {
    const e = d.experience;
    if (!e?.title?.trim()) continue;
    const key = String(e.id ?? e.title);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name: e.title.trim(), icon: '📍' });
  }
  return rows;
}

export function buildBudgetOptionsPayload(b: BudgetOptionsDraft): BudgetOptionsPayload {
  const economy_total = parseOptionalPositiveNumber(b.economy);
  const standard_total = parseOptionalPositiveNumber(b.standard);
  const luxury_total = parseOptionalPositiveNumber(b.luxury);
  const currency = b.currency.trim() || null;
  return {
    economic: economy_total ?? null,
    standard: standard_total ?? null,
    luxury: luxury_total ?? null,
    economy_total: economy_total ?? null,
    standard_total: standard_total ?? null,
    luxury_total: luxury_total ?? null,
    currency,
  };
}

export function buildFlightDetailsPayload(f: FlightDetailsDraft): Record<string, string> {
  return {
    from_city: f.from_city.trim(),
    to_city: f.to_city.trim(),
    destination_flag: f.destination_flag.trim(),
    flight_number: f.flight_number.trim(),
    airport: f.airport.trim(),
    terminal: f.terminal.trim(),
    leave_home_time: f.leave_home_time.trim(),
  };
}

export function resolveDestination(draft: ItineraryDraft): string | null {
  const d = draft.destination.trim() || draft.flight.to_city.trim();
  return d || null;
}

export function buildDatesField(draft: ItineraryDraft): string | null {
  const from = draft.datesFrom.trim();
  const to = draft.datesTo.trim();
  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  return null;
}

export function generatePasscode(customerName: string, destinationSeed: string): string {
  const namePart =
    customerName
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, 'X') || 'WL';
  const destPart =
    destinationSeed
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 2)
      .padEnd(2, 'X') || 'XX';
  return `WL-${namePart}-${destPart}`;
}

export type BuildItineraryPayloadOptions = {
  isTemplate?: boolean;
  employeeId?: number | null;
  autoPasscode?: boolean;
};

/** كائن JSON موحّد قبل الإرسال إلى Supabase */
export function buildItinerarySupabasePayload(
  draft: ItineraryDraft,
  options: BuildItineraryPayloadOptions = {},
): Record<string, unknown> {
  const destination = resolveDestination(draft);
  const days_data = buildDaysDataForSave(draft.days);
  const hotel_details = deriveHotelDetailsFromDays(draft.days);
  const experiences_details = deriveExperiencesDetailsFromDays(draft.days);
  const budget_options = buildBudgetOptionsPayload(draft.budgetOptions);
  const flight_details = buildFlightDetailsPayload(draft.flight);
  const weatherRaw = draft.weatherTemp.trim().replace(/,/g, '');
  const weather_temp = weatherRaw && Number.isFinite(Number(weatherRaw)) ? Number(weatherRaw) : null;

  const parsedTotalPrice = parseOptionalPositiveNumber(draft.budgetTracking.totalPrice);
  const total_budget = parseBudgetAmountForSave(draft.budgetTracking.totalBudget);
  const spent_amount = parseBudgetAmountForSave(draft.budgetTracking.spentAmount);

  const passcode =
    draft.passcode.trim().toUpperCase() ||
    (options.autoPasscode !== false
      ? generatePasscode(draft.customerName, destination || draft.title)
      : '');

  const organizerId =
    draft.tripMode === 'Group'
      ? draft.groupMemberIds[0]
      : draft.linkedClientId && Number.isFinite(Number(draft.linkedClientId))
        ? Number(draft.linkedClientId)
        : null;

  const payload: Record<string, unknown> = {
    customer_name: draft.customerName.trim() || (options.isTemplate ? 'قالب جاهز' : ''),
    title: draft.title.trim(),
    days_data,
    budget_options,
    flight_details,
    weather_temp,
    highlights: [...draft.highlights],
    local_lingo: draft.localLingo
      .map((r) => ({
        arabic_word: r.arabic_word.trim(),
        local_word: r.local_word.trim(),
      }))
      .filter((r) => r.arabic_word || r.local_word),
    ...(destination ? { destination } : {}),
    ...(buildDatesField(draft) ? { dates: buildDatesField(draft) } : {}),
    ...(passcode ? { passcode } : {}),
    ...(hotel_details.length > 0 ? { hotel_details } : {}),
    ...(experiences_details.length > 0 ? { experiences_details } : {}),
    include_wardrobe: draft.includeWardrobe,
    unlock_secret_guide: draft.unlockSecretGuide,
    trip_type: draft.tripMode,
    group_name: draft.tripMode === 'Group' ? draft.groupName.trim() : null,
    ...(parsedTotalPrice != null ? { total_price: parsedTotalPrice } : {}),
    total_budget,
    spent_amount,
    destination_story: draft.discover.destinationStory.trim() || null,
    taxi_phrase: draft.discover.taxiPhrase.trim() || null,
    secret_gem: draft.discover.secretGem.trim() || null,
    ...(organizerId != null ? { client_id: organizerId } : {}),
    ...(options.employeeId ? { created_by_employee_id: options.employeeId } : {}),
  };

  if (options.isTemplate) {
    payload.is_template = true;
    payload.status = 'template';
  }

  return payload;
}

export function parseDatesField(dates: unknown): { from: string; to: string } {
  if (dates == null) return { from: '', to: '' };
  const raw = String(dates).trim();
  if (!raw) return { from: '', to: '' };
  const parts = raw.split('→').map((x) => x.trim());
  if (parts.length >= 2) {
    return { from: parts[0].slice(0, 10), to: parts[1].slice(0, 10) };
  }
  return { from: raw.slice(0, 10), to: '' };
}

export function importDaysFromTemplate(
  templateDays: Array<Record<string, unknown>> | null | undefined,
): ItineraryDayDraft[] {
  if (!Array.isArray(templateDays) || templateDays.length === 0) {
    return [createEmptyDay(0)];
  }

  return templateDays.map((d, idx) => {
    const rawStops = Array.isArray(d.stops)
      ? d.stops
      : Array.isArray(d.itinerary_stops)
        ? d.itinerary_stops
        : [];
    const stops: ItineraryStopDraft[] =
      rawStops.length > 0
        ? rawStops.map((raw, si) => {
            const s = raw as Record<string, unknown>;
            return {
              id: newLocalId(),
              place_name: String(s.place_name ?? s.name ?? '').trim(),
              time_slot: String(s.time_slot ?? s.time ?? '').trim(),
              note: String(s.note ?? '').trim(),
              story: String(s.story ?? s.description ?? '').trim(),
              transport_type: String(s.transport_type ?? s.taxi ?? '').trim(),
              lat: s.lat != null ? String(s.lat) : s.latitude != null ? String(s.latitude) : '',
              lng: s.lng != null ? String(s.lng) : s.longitude != null ? String(s.longitude) : '',
              category: String(s.category ?? 'o').trim() || 'o',
            };
          })
        : [createEmptyStop()];

    const rawAlts = Array.isArray(d.alternative_hotels) ? d.alternative_hotels : [];
    const alternative_hotels: AlternativeHotel[] = rawAlts
      .map((row, j) => {
        const r = row as Record<string, unknown>;
        const h = r.hotel as HotelRow | null;
        if (!h) return null;
        return {
          id: String(r.id ?? `alt-import-${idx}-${j}`),
          hotel: h,
          tier: normalizeTier(r.tier),
        };
      })
      .filter((x): x is AlternativeHotel => x != null);

    return {
      id: `day-import-${Date.now()}-${idx}`,
      title: String(d.title ?? '').trim() || `اليوم ${dayLabel(idx)}`,
      city: String(d.city ?? '').trim(),
      notes: String(d.notes ?? '').trim(),
      stops,
      hotel: (d.hotel as HotelRow | null) ?? null,
      alternative_hotels,
      experience: (d.experience as ExperienceRow | null) ?? null,
    };
  });
}

export function draftFromTemplate(template: Record<string, unknown>): Partial<ItineraryDraft> {
  const bo = template.budget_options as BudgetOptionsPayload | null | undefined;
  const fd = template.flight_details as Record<string, string> | null | undefined;
  const { from, to } = parseDatesField(template.dates);

  const budgetOptions: BudgetOptionsDraft = {
    economy: bo?.economic != null ? String(bo.economic) : bo?.economy_total != null ? String(bo.economy_total) : '',
    standard: bo?.standard != null ? String(bo.standard) : bo?.standard_total != null ? String(bo.standard_total) : '',
    luxury: bo?.luxury != null ? String(bo.luxury) : bo?.luxury_total != null ? String(bo.luxury_total) : '',
    currency: bo?.currency ? String(bo.currency) : 'SAR',
  };

  return {
    customerName: String(template.customer_name ?? '').trim(),
    title: String(template.title ?? '').trim(),
    datesFrom: from,
    datesTo: to,
    destination: String(template.destination ?? '').trim(),
    flight: {
      from_city: String(fd?.from_city ?? ''),
      to_city: String(fd?.to_city ?? ''),
      destination_flag: String(fd?.destination_flag ?? ''),
      flight_number: String(fd?.flight_number ?? ''),
      airport: String(fd?.airport ?? ''),
      terminal: String(fd?.terminal ?? ''),
      leave_home_time: String(fd?.leave_home_time ?? ''),
    },
    weatherTemp: template.weather_temp != null ? String(template.weather_temp) : '',
    highlights: Array.isArray(template.highlights) ? (template.highlights as string[]) : [],
    budgetOptions,
    discover: {
      destinationStory: String(template.destination_story ?? '').trim(),
      taxiPhrase: String(template.taxi_phrase ?? '').trim(),
      secretGem: String(template.secret_gem ?? '').trim(),
    },
    localLingo: Array.isArray(template.local_lingo)
      ? (template.local_lingo as Array<Record<string, string>>).map((r) => ({
          id: newLocalId(),
          arabic_word: String(r.arabic_word ?? ''),
          local_word: String(r.local_word ?? ''),
        }))
      : [],
    days: importDaysFromTemplate(template.days_data as Array<Record<string, unknown>> | undefined),
    includeWardrobe: template.include_wardrobe === true,
    unlockSecretGuide: template.unlock_secret_guide === true,
  };
}
