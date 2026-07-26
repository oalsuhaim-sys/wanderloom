import {
  createEmptyDay,
  parseHotelsFromDetailsRaw,
  withTransportDefaults,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { parseDaysDataFromRow } from '@/lib/public-itinerary';

export type ItineraryTemplateRow = {
  id: string;
  title: string;
  template_name?: string | null;
  destination: string | null;
  days_data: unknown;
  hotel_details?: unknown;
  source_itinerary_id?: string | number | null;
  created_at?: string;
};

function templateDisplayTitle(row: Record<string, unknown>): string {
  return (
    String(row.template_name ?? row.title ?? 'قالب').trim() || 'قالب'
  );
}

function transitModeToArabic(mode: unknown): string {
  const m = String(mode ?? '').toLowerCase();
  if (m.includes('walk') || m === 'walking' || m === 'مشي') return 'مشي';
  if (m.includes('metro') || m.includes('train') || m.includes('subway') || m === 'مترو') return 'مترو';
  return 'سيارة';
}

export function templateDaysToSimpleDays(raw: unknown): SimpleItineraryDay[] {
  const { days: parsed } = parseDaysDataFromRow(raw);
  if (!parsed.length) return [createEmptyDay(0)];

  return parsed.map((d: Record<string, unknown>, idx: number) => {
    if (Array.isArray(d.places)) {
      return {
        id: typeof d.id === 'number' ? d.id : Date.now() + idx,
        title: String(d.title ?? `اليوم ${idx + 1}`),
        hotelName: String(d.hotelName ?? d.hotel_name ?? '').trim() || undefined,
        places: (d.places as unknown[]).map((p) => withTransportDefaults(p as Record<string, unknown>)),
      };
    }

    const stops = (d.itinerary_stops ?? d.stops ?? []) as Array<Record<string, unknown>>;
    const places = stops.map((s) =>
      withTransportDefaults({
        id: s.places_bank_id ?? s.id,
        name: String(s.place_name ?? s.name ?? 'محطة').trim(),
        category: s.category,
        city: d.city ?? s.city,
        rating: s.rating,
        transportToNext: transitModeToArabic(s.transit_mode ?? s.transport_type),
        transportDuration: String(s.transit_duration ?? '').trim(),
      }),
    );

    return {
      id: typeof d.id === 'number' ? d.id : Date.now() + idx,
      title: String(d.title ?? `اليوم ${idx + 1}`),
      hotelName:
        String(d.hotelName ?? d.hotel_name ?? (d.hotel as { name?: string } | undefined)?.name ?? '')
          .trim() || undefined,
      places,
    };
  });
}

export function computeTripEndFromStart(startIso: string, dayCount: number): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(dayCount - 1, 0));
  return end.toISOString().slice(0, 10);
}

export type ApplyTemplateResult = {
  days: SimpleItineraryDay[];
  destination: string;
  hotels: ItineraryHotelEntry[];
  datesFrom?: string;
  datesTo?: string;
};

export function applyTemplateToBuilder(
  template: ItineraryTemplateRow,
  options: { currentDateFrom?: string } = {},
): ApplyTemplateResult {
  const days = templateDaysToSimpleDays(template.days_data);
  const destination = String(template.destination ?? template.title ?? '').trim();
  const hotels = parseHotelsFromDetailsRaw(template.hotel_details);

  const result: ApplyTemplateResult = { days, destination, hotels };

  const from = options.currentDateFrom?.trim();
  if (from) {
    result.datesFrom = from;
    result.datesTo = computeTripEndFromStart(from, days.length);
  }

  return result;
}

export function formatSupabaseTemplateError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null): string {
  if (!error) return 'Unknown Supabase error';
  return [error.message, error.details, error.hint, error.code ? `(${error.code})` : '']
    .filter(Boolean)
    .join(' — ');
}

export async function fetchItineraryTemplates(
  supabase: NonNullable<typeof import('@/lib/supabase').supabase>,
): Promise<{ templates: ItineraryTemplateRow[]; usedFallback: boolean }> {
  const extendedSelect =
    'id, template_name, title, destination, days_data, hotel_details, flight_details, source_itinerary_id, created_at';
  const basicSelect =
    'id, title, destination, days_data, hotel_details, source_itinerary_id, created_at';

  let data: Record<string, unknown>[] | null = null;
  let error: { message?: string; details?: string; hint?: string; code?: string } | null = null;

  const extended = await supabase
    .from('itinerary_templates')
    .select(extendedSelect)
    .order('created_at', { ascending: false });

  if (!extended.error && extended.data) {
    data = extended.data as Record<string, unknown>[];
  } else if (
    extended.error &&
    /template_name|column|schema/i.test(extended.error.message ?? '')
  ) {
    const basic = await supabase
      .from('itinerary_templates')
      .select(basicSelect)
      .order('created_at', { ascending: false });
    data = (basic.data as Record<string, unknown>[]) ?? null;
    error = basic.error;
  } else {
    data = (extended.data as Record<string, unknown>[]) ?? null;
    error = extended.error;
  }

  if (!error && data) {
    return {
      templates: data.map((row) => ({
        id: String(row.id),
        title: templateDisplayTitle(row),
        template_name: row.template_name != null ? String(row.template_name) : null,
        destination: String(row.destination ?? '').trim() || null,
        days_data: row.days_data,
        hotel_details: row.hotel_details,
        source_itinerary_id: row.source_itinerary_id as string | number | null | undefined,
        created_at: row.created_at as string | undefined,
      })),
      usedFallback: false,
    };
  }

  const msg = error?.message ?? '';
  if (!/relation|does not exist|schema/i.test(msg)) {
    throw new Error(formatSupabaseTemplateError(error));
  }

  const fallback = await supabase
    .from('itineraries')
    .select('id, title, destination, days_data, hotel_details, created_at')
    .eq('is_template', true)
    .order('created_at', { ascending: false });

  if (fallback.error) throw new Error(formatSupabaseTemplateError(fallback.error));

  return {
    templates: ((fallback.data as Record<string, unknown>[]) ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? 'قالب'),
      destination: String(row.destination ?? '').trim() || null,
      days_data: row.days_data,
      hotel_details: row.hotel_details,
      source_itinerary_id: row.id,
      created_at: row.created_at as string | undefined,
    })),
    usedFallback: true,
  };
}

export function buildTemplateFlightDetails(input: {
  originCity?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  gate?: string;
  seat?: string;
  bookingRef?: string;
  flightNumber?: string;
  terminal?: string;
  flightClass?: string;
  departureCountry?: string;
  arrivalCountry?: string;
}): Record<string, unknown> | null {
  const origin = input.originCity?.trim() ?? '';
  const destination = input.destination?.trim() ?? '';
  const departure = input.departureTime?.trim() ?? '';
  const arrival = input.arrivalTime?.trim() ?? '';
  const gate = input.gate?.trim() ?? '';
  const seat = input.seat?.trim() ?? '';
  const bookingRef = input.bookingRef?.trim() ?? '';
  const flightNumber = input.flightNumber?.trim() ?? '';
  const terminal = input.terminal?.trim() ?? '';
  const flightClass = input.flightClass?.trim() ?? '';
  const departureCountry = input.departureCountry?.trim() ?? '';
  const arrivalCountry = input.arrivalCountry?.trim() ?? '';

  if (
    !origin &&
    !destination &&
    !departure &&
    !arrival &&
    !gate &&
    !seat &&
    !bookingRef &&
    !flightNumber &&
    !terminal &&
    !flightClass &&
    !departureCountry &&
    !arrivalCountry
  ) {
    return null;
  }

  return {
    flight_from: origin,
    flight_to: destination,
    from_city: origin,
    to_city: destination,
    departure_time: departure,
    arrival_time: arrival,
    gate,
    seat,
    flight_seat: seat,
    flight_number: flightNumber,
    terminal,
    flight_class: flightClass,
    departure_country: departureCountry,
    arrival_country: arrivalCountry,
    ...(bookingRef ? { booking_reference: bookingRef, pnr: bookingRef } : {}),
  };
}

export async function saveItineraryTemplate(
  supabase: NonNullable<typeof import('@/lib/supabase').supabase>,
  input: {
    templateName: string;
    destination: string;
    daysData: unknown;
    hotelDetails?: unknown;
    flightDetails?: unknown;
    sourceItineraryId?: string | number;
  },
): Promise<{ id: string; usedFallback: boolean }> {
  const template_name = input.templateName.trim();
  if (!template_name) {
    throw new Error('template_name is required');
  }

  /** لا نُرسل id ولا created_at — يُولَّدان تلقائياً في Postgres */
  const payload: Record<string, unknown> = {
    template_name,
    title: template_name,
    destination: input.destination.trim() || null,
    days_data: input.daysData,
    hotel_details: input.hotelDetails ?? null,
    flight_details: input.flightDetails ?? null,
    source_itinerary_id:
      input.sourceItineraryId != null && Number.isFinite(Number(input.sourceItineraryId))
        ? Number(input.sourceItineraryId)
        : null,
  };

  const { data, error } = await supabase
    .from('itinerary_templates')
    .insert(payload)
    .select('id')
    .single();

  if (!error && data) {
    return { id: String((data as { id: string }).id), usedFallback: false };
  }

  if (error && /title|column|schema/i.test(error.message ?? '')) {
    const { template_name: _tn, title: _t, ...withoutTitle } = payload;
    const retry = await supabase
      .from('itinerary_templates')
      .insert({ template_name, ...withoutTitle })
      .select('id')
      .single();
    if (!retry.error && retry.data) {
      return { id: String((retry.data as { id: string }).id), usedFallback: false };
    }
    throw new Error(formatSupabaseTemplateError(retry.error));
  }

  throw new Error(formatSupabaseTemplateError(error));
}
