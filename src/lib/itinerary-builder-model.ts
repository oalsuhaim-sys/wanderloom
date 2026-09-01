import {
  collapseDayForSave,
  dayToActivities,
  patchDayActivities,
} from '@/lib/itinerary-day-activities';
import {
  buildHotelDetailsForSave,
  createEmptyPrimaryHotelBooking,
  primaryHotelFromHotelDetailsRaw,
  type PrimaryHotelBookingDraft,
} from '@/lib/crm-booking-details';

export type { PrimaryHotelBookingDraft };
import {
  extractVipSummaryFields,
  parseDaysDataFromRow,
  resolveVipTransitIconKind,
  serializePreTripServicesForSave,
  type PreTripService,
} from '@/lib/public-itinerary';
import { serializeQuotationDetails, type QuotationDetails } from '@/lib/quotation-details';
import { serializeItineraryDocuments, type ItineraryDocument } from '@/lib/itinerary-documents';
import { serializeSupplierRequests, type SupplierRequest } from '@/lib/supplier-requests';
import { serializeActivityTickets } from '@/lib/itinerary-tickets';
import { coerceClientIdForItinerarySave } from '@/lib/itinerary-client-crm';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { isTripFinished } from '@/lib/client-portal-trip-phase';
import type { ExperienceRow } from '@/types/experience';
import type { HotelRow } from '@/types/hotel';

export type HotelTier = 'economy' | 'standard' | 'luxury';

export type AlternativeHotel = {
  id: string;
  hotel: HotelRow;
  tier: HotelTier;
};

export type TransitMode = 'car' | 'walk' | 'metro' | '';

/** محطة ضمن يوم — انتقال منظّم إلى المحطة التالية */
export type ItineraryStopDraft = {
  id: string;
  place_name: string;
  /** وقت الزيارة (HH:MM) — الحقل المعتمد في CRM والبوابة */
  visit_time: string;
  /** @deprecated — يُزامن مع visit_time للتوافق مع البيانات القديمة */
  time_slot: string;
  note: string;
  story: string;
  /** @deprecated — يُستورد للتوافق فقط */
  transport_type: string;
  transit_mode: TransitMode;
  transit_duration: string;
  maps_url: string;
  booking_url: string;
  lat: string;
  lng: string;
  category: string;
  places_bank_id?: string;
  image_url?: string;
};

export type DayActivityKind = 'place' | 'transport' | 'hotel' | 'experience';

export type DayActivityDraft = {
  id: string;
  kind: DayActivityKind;
  /** وقت الزيارة (HH:MM) */
  visit_time: string;
  /** @deprecated — مزامن مع visit_time */
  time_slot: string;
  transit_mode: TransitMode;
  transit_duration: string;
  place_name: string;
  story: string;
  note: string;
  maps_url: string;
  booking_url: string;
  lat: string;
  lng: string;
  category: string;
  hotel: HotelRow | null;
  experience: ExperienceRow | null;
  places_bank_id?: string;
  country?: string;
  city?: string;
  image_url?: string;
};

export type ItineraryDayDraft = {
  id: string;
  title: string;
  city: string;
  notes: string;
  stops: ItineraryStopDraft[];
  activities: DayActivityDraft[];
  hotel: HotelRow | null;
  alternative_hotels: AlternativeHotel[];
  experience: ExperienceRow | null;
};

export const FLIGHT_CLASS_OPTIONS = [
  'Economy',
  'Premium Economy',
  'Business',
  'First Class',
] as const;

export type FlightClassOption = (typeof FLIGHT_CLASS_OPTIONS)[number];

export type FlightDetailsDraft = {
  flight_from: string;
  flight_to: string;
  flight_number: string;
  flight_seat: string;
  /** وقت المغادرة — يُحفظ أيضاً كـ departure_time */
  flight_time: string;
  departure_time: string;
  arrival_time: string;
  gate: string;
  booking_reference: string;
  destination_flag: string;
  airport: string;
  terminal: string;
  /** درجة الإركاب — Economy, Business, … */
  flight_class: string;
  /** دولة المغادرة — تُعرض بدل DEP في بطاقة الصعود */
  departure_country: string;
  /** دولة الوصول — تُعرض بدل ARR في بطاقة الصعود */
  arrival_country: string;
};

export type BudgetOptionsDraft = {
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
  /** الفندق الرئيسي للحجز — يُحفظ في hotel_details[0] */
  primaryHotel: PrimaryHotelBookingDraft;
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
  /** ملخص الطقس — تبويب الرئيسية للعميل VIP */
  weatherSummary: string;
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

export const TIER_LABELS: Record<HotelTier, string> = {
  economy: 'اقتصادي',
  standard: 'قياسي',
  luxury: 'فاخر',
};

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dayLabel(index: number): string {
  return DAY_LABELS[index] ?? `${index + 1}`;
}

export function normalizeTransitMode(raw: unknown): TransitMode {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'metro' || s === 'walk' || s === 'car') return s;
  if (s) {
    const kind = resolveVipTransitIconKind(s);
    if (kind === 'metro') return 'metro';
    if (kind === 'walk') return 'walk';
    if (kind === 'car') return 'car';
  }
  return '';
}

export function resolveVisitTime(raw: {
  visit_time?: unknown;
  time_slot?: unknown;
  time?: unknown;
  start_time?: unknown;
}): string {
  return String(
    raw.visit_time ?? raw.time_slot ?? raw.time ?? raw.start_time ?? '',
  ).trim();
}

export function createEmptyStop(): ItineraryStopDraft {
  return {
    id: newLocalId(),
    place_name: '',
    visit_time: '',
    time_slot: '',
    note: '',
    story: '',
    transport_type: '',
    transit_mode: '',
    transit_duration: '',
    maps_url: '',
    booking_url: '',
    lat: '',
    lng: '',
    category: 'o',
  };
}

export function createTransportStop(): ItineraryStopDraft {
  return {
    ...createEmptyStop(),
    category: 'transport',
    place_name: 'انتقال / مواصلات',
  };
}

export function createEmptyDay(index: number): ItineraryDayDraft {
  return {
    id: `day-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title: `اليوم ${dayLabel(index)}`,
    city: '',
    notes: '',
    stops: [],
    activities: [],
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
      flight_from: '',
      flight_to: '',
      flight_number: '',
      flight_seat: '',
      flight_time: '',
      departure_time: '',
      arrival_time: '',
      gate: '',
      booking_reference: '',
      destination_flag: '',
      airport: '',
      terminal: '',
      flight_class: '',
      departure_country: '',
      arrival_country: '',
    },
    primaryHotel: createEmptyPrimaryHotelBooking(),
    weatherTemp: '',
    highlights: [],
    budgetOptions: { currency: 'SAR' },
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
    weatherSummary: '',
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

/** مدخلات صفحات builder/edit البسيطة — بدون حقول واجهة زائدة */
export type StrictSimpleItinerarySaveInput = {
  daysData: unknown;
  budget: string;
  paid: string;
  departureTime: string;
  arrivalTime: string;
  bookingRef: string;
  passcode?: string;
  /** عنوان بطاقة الرحلة — يُعرض في قائمة المسارات */
  title?: string;
  destination?: string;
  /** تواريخ الرحلة — تُحفظ في عمود dates */
  datesFrom?: string;
  datesTo?: string;
  originCity?: string;
  /** مدينة الوصول لرحلة الطيران — منفصلة عن وجهة المسار */
  arrivalCity?: string;
  gate?: string;
  seat?: string;
  flightNumber?: string;
  terminal?: string;
  flightClass?: string;
  departureCountry?: string;
  arrivalCountry?: string;
  /** قائمة الفنادق — تُحفظ في hotel_details */
  hotels?: Array<{ name: string; pnr?: string; checkIn?: string; checkOut?: string }>;
  hotelName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  clientId?: number | string | null;
  /** خبير الوجهة — يُحفظ في expert_id */
  expertId?: string | null;
  /** اسم الخبير للعرض في مركز قيادة المسارات */
  expertName?: string | null;
  customerName?: string;
  preTripServices?: PreTripService[];
  includeWardrobe?: boolean;
  quotationDetails?: QuotationDetails | null;
  documents?: ItineraryDocument[];
  supplierRequests?: SupplierRequest[];
  ticketDetails?: import('@/lib/itinerary-tickets').ActivityTicket[];
  isQuotation?: boolean;
  isMedical?: boolean;
  showFashionServices?: boolean;
  /** حالة المسار — يُطبَّع دائماً لقيمة مسموحة في Supabase */
  status?: string;
  geoTripType?: 'single' | 'multi';
  countries?: string[];
  cities?: string[];
};

const VALID_ITINERARY_STATUSES = ['active', 'draft', 'sent', 'confirmed', 'archived'] as const;

export function normalizeItinerarySaveStatus(raw?: string | null): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if ((VALID_ITINERARY_STATUSES as readonly string[]).includes(s)) return s;
  return 'active';
}

export function buildDatesFieldFromParts(from: string, to: string): string | null {
  const f = from.trim();
  const t = to.trim();
  if (f && t) return `${f} → ${t}`;
  if (f) return f;
  return null;
}

/** ISO YYYY-MM-DD only — empty string if invalid */
export function normalizeIsoDateOnly(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Mirrors trip dates onto `dates` + `start_date`/`end_date` so the client app
 * (which prefers end_date) stays in sync with admin edits.
 * When end_date is still in the future, re-opens status to `active`.
 */
export function applyItineraryTripDatesToPayload(
  payload: Record<string, unknown>,
  datesFrom: string | null | undefined,
  datesTo: string | null | undefined,
  options?: { resetStatusWhenFuture?: boolean },
): Record<string, unknown> {
  const from = normalizeIsoDateOnly(datesFrom);
  const to = normalizeIsoDateOnly(datesTo);
  const dates = buildDatesFieldFromParts(from, to);
  if (dates) payload.dates = dates;
  if (from) {
    payload.start_date = from;
    payload.end_date = to || from;
  } else if (to) {
    payload.end_date = to;
  }

  const endForStatus = normalizeIsoDateOnly(
    payload.end_date != null ? String(payload.end_date) : to || from,
  );
  if (
    options?.resetStatusWhenFuture !== false &&
    endForStatus &&
    !isTripFinished(endForStatus)
  ) {
    payload.status = 'active';
  }

  return payload;
}

/**
 * حمولة update/insert محدودة — أعمدة معروفة فقط + JSONB للطيران/الفندق.
 * يمنع PGRST204 من إرسال aliases مثل paid، spent_amount، days_json، hotel_name، …
 */
export function buildStrictSimpleItinerarySavePayload(
  input: StrictSimpleItinerarySaveInput,
): Record<string, unknown> {
  const budgetNum = parseBudgetAmountForSave(input.budget);
  const paidNum = parseBudgetAmountForSave(input.paid);
  const bookingRef = input.bookingRef.trim();
  const origin = input.originCity?.trim() ?? '';
  const arrival = normalizeSingleArrivalCity(input.arrivalCity?.trim() ?? '');
  const destination = input.destination?.trim() ?? '';
  const title = input.title?.trim() || destination;
  const geoTripType = input.geoTripType ?? 'single';
  const countries = input.countries ?? [];
  const cities = input.cities ?? [];

  const payload: Record<string, unknown> = {
    days_data: input.daysData,
    amount_paid: paidNum,
    total_budget: budgetNum,
    budget: budgetNum,
    departure_time: input.departureTime.trim() || null,
    arrival_time: input.arrivalTime.trim() || null,
    booking_ref: bookingRef || null,
  };

  const passcode = input.passcode?.trim().toUpperCase();
  if (passcode) payload.passcode = passcode;
  if (title) payload.title = title;
  if (destination || title) payload.destination = destination || title;

  applyItineraryTripDatesToPayload(payload, input.datesFrom, input.datesTo, {
    // Status is applied below from input; still re-open when end is future.
    resetStatusWhenFuture: true,
  });

  if (input.clientId !== undefined) {
    // يسمح بـ null لمسح الربط (مسار جماعي مستقل)
    payload.client_id = input.clientId;
  }
  if (input.expertId !== undefined) {
    const expertId = String(input.expertId ?? '').trim();
    payload.expert_id = expertId || null;
  }
  if (input.expertName !== undefined) {
    payload.expert_name = String(input.expertName ?? '').trim() || null;
  }
  if (input.customerName !== undefined) {
    payload.customer_name = input.customerName.trim() || null;
  }

  // Always mirror expert into days_data.meta so dashboard can read it even if
  // expert_name / expert_id columns are missing or blocked by FK/RLS.
  payload.days_data = withItineraryExpertMeta(
    payload.days_data,
    input.expertId,
    input.expertName,
  );

  payload.flight_details = {
    flight_from: origin,
    flight_to: arrival,
    from_city: origin,
    to_city: arrival,
    departure_time: input.departureTime.trim(),
    arrival_time: input.arrivalTime.trim(),
    gate: input.gate?.trim() ?? '',
    seat: input.seat?.trim() ?? '',
    flight_seat: input.seat?.trim() ?? '',
    flight_number: input.flightNumber?.trim() ?? '',
    terminal: input.terminal?.trim() ?? '',
    flight_class: input.flightClass?.trim() ?? '',
    departure_country: input.departureCountry?.trim() ?? '',
    arrival_country: input.arrivalCountry?.trim() ?? '',
    geo_trip_type: geoTripType,
    destination_trip_type: geoTripType,
    countries,
    cities,
    // Durable expert mirror (flight_details JSONB exists in production)
    ...(String(input.expertId ?? '').trim()
      ? { expert_id: String(input.expertId).trim() }
      : {}),
    ...(String(input.expertName ?? '').trim()
      ? { expert_name: String(input.expertName).trim() }
      : {}),
    ...(bookingRef ? { booking_reference: bookingRef, pnr: bookingRef } : {}),
  };

  const hotelRows =
    input.hotels?.filter((h) => h.name?.trim()) ??
    (input.hotelName?.trim()
      ? [
          {
            name: input.hotelName.trim(),
            pnr: bookingRef || undefined,
            checkIn: input.checkInDate,
            checkOut: input.checkOutDate,
          },
        ]
      : []);

  if (hotelRows.length > 0) {
    payload.hotel_details = hotelRows.map((h) => ({
      name: h.name.trim(),
      check_in: h.checkIn || undefined,
      check_out: h.checkOut || undefined,
      check_in_date: h.checkIn || undefined,
      check_out_date: h.checkOut || undefined,
      ...(h.pnr?.trim() ? { booking_reference: h.pnr.trim(), pnr: h.pnr.trim() } : {}),
    }));
  }

  if (input.preTripServices !== undefined) {
    payload.pre_trip_services = serializePreTripServicesForSave(input.preTripServices);
  }

  if (input.includeWardrobe !== undefined) {
    payload.include_wardrobe = input.includeWardrobe;
  }

  if (input.quotationDetails !== undefined) {
    payload.quotation_details = input.quotationDetails
      ? serializeQuotationDetails(input.quotationDetails)
      : null;
  }

  if (input.documents !== undefined) {
    payload.documents = serializeItineraryDocuments(input.documents);
  }

  if (input.supplierRequests !== undefined) {
    payload.supplier_requests = serializeSupplierRequests(input.supplierRequests);
  }

  if (input.ticketDetails !== undefined) {
    payload.ticket_details = serializeActivityTickets(input.ticketDetails);
  }

  if (input.isQuotation !== undefined) {
    payload.is_quotation = input.isQuotation;
  }
  if (input.isMedical !== undefined) {
    payload.is_medical = input.isMedical;
  }
  if (input.showFashionServices !== undefined) {
    payload.show_fashion_services = input.showFashionServices;
  }

  // Future end_date already forced `active` in applyItineraryTripDatesToPayload.
  if (payload.status !== 'active') {
    payload.status = normalizeItinerarySaveStatus(input.status);
  }

  return payload;
}

export type ItineraryTripType = 'Individual' | 'Group';

export function buildStrictSimpleItineraryInsertPayload(
  input: StrictSimpleItinerarySaveInput & {
    title?: string;
    customerName: string;
    clientId?: number | string | null;
    /** Individual = رحلة خاصة · Group = رحلة جماعية */
    tripType?: ItineraryTripType;
    /** مطلوب للرحلة الخاصة — null للجماعية */
    quoteId?: string | null;
    groupName?: string | null;
  },
): Record<string, unknown> {
  const tripTitle = input.title?.trim() || input.destination?.trim() || 'مسار VIP جديد';
  const tripType: ItineraryTripType = input.tripType === 'Group' ? 'Group' : 'Individual';
  const isGroup = tripType === 'Group';
  const quoteId = !isGroup && input.quoteId ? String(input.quoteId).trim() : '';

  return {
    ...buildStrictSimpleItinerarySavePayload({
      ...input,
      title: tripTitle,
      // للجماعية لا نربط عميلاً؛ للخاصة نمرّر المعرّف أو null
      clientId: isGroup ? null : (input.clientId ?? null),
      customerName: isGroup
        ? input.customerName.trim() || input.groupName?.trim() || 'رحلة جماعية'
        : input.customerName,
    }),
    title: tripTitle,
    customer_name: isGroup
      ? input.customerName.trim() || input.groupName?.trim() || 'رحلة جماعية'
      : input.customerName.trim() || 'عميل VIP',
    trip_type: tripType,
    group_name: isGroup ? input.groupName?.trim() || null : null,
    // صريح: الجماعية بلا client_id / quote_id
    client_id: isGroup ? null : (input.clientId ?? null),
    quote_id: quoteId || null,
  };
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
    category: h.category,
    notes: h.notes,
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
      const place_name = (s.place_name || '').trim();
      const story = (s.story || '').trim();
      const note = (s.note || '').trim();
      const transit_mode = normalizeTransitMode(s.transit_mode || s.transport_type) || 'car';
      const transit_duration = (s.transit_duration || '').trim();
      const legacyTransport = (s.transport_type || '').trim();
      if (!place_name && !note && !story && !transit_duration && index === 0) return null;

      const visit_time = (s.visit_time || s.time_slot || '').trim();
      const lat = parseCoord(s.lat);
      const lng = parseCoord(s.lng);
      const maps_url = s.maps_url?.trim() || undefined;
      const booking_url = s.booking_url?.trim() || undefined;

      return {
        sort_order: index + 1,
        place_name: place_name || 'محطة',
        visit_time: visit_time || undefined,
        time_slot: visit_time || undefined,
        note: note || story || undefined,
        ...(note ? { notes: note } : {}),
        story: story || undefined,
        description: story || undefined,
        ...(index > 0 ? { transit_mode, transit_duration } : {}),
        ...(legacyTransport ? { transport_type: legacyTransport, taxi: legacyTransport } : {}),
        category: s.category.trim() || 'o',
        ...(maps_url ? { maps_url, google_maps_url: maps_url } : {}),
        ...(booking_url ? { booking_url } : {}),
        ...(lat != null ? { lat, latitude: lat } : {}),
        ...(lng != null ? { lng, longitude: lng } : {}),
        ...(s.places_bank_id?.trim() ? { places_bank_id: s.places_bank_id.trim() } : {}),
        ...(s.image_url?.trim()
          ? { image_url: s.image_url.trim(), photo: s.image_url.trim() }
          : {}),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export type VipClientSummaryPatch = {
  weather_summary: string | null;
};

/** ملخص VIP للعميل — عمود weather_summary (+ نسخة احتياطية داخل days_data عند الحاجة) */
export function buildVipClientSummaryPatch(draft: ItineraryDraft): VipClientSummaryPatch {
  return {
    weather_summary: draft.weatherSummary.trim() || null,
  };
}

export function buildDaysDataForSave(days: ItineraryDayDraft[]) {
  return days.map((d, idx) => {
    const { hotel, experience, stops } = collapseDayForSave(d);
    const stopsPayload = buildStopsForSave(stops);
    return {
      day_number: idx + 1,
      title: d.title,
      city: d.city.trim() || undefined,
      notes: d.notes,
      stops: stopsPayload,
      itinerary_stops: stopsPayload,
      hotel: serializeHotelSnapshot(hotel),
      alternative_hotels: d.alternative_hotels.map((a) => ({
        id: a.id,
        tier: a.tier,
        hotel: serializeHotelSnapshot(a.hotel),
      })),
      experience: serializeExperienceSnapshot(experience),
    };
  });
}

/** يحفظ الأيام + ملخصات مضمّنة إذا وُجدت (عند غياب أعمدة الملخص في المخطط) */
export function buildDaysDataPayloadForSave(
  days: ItineraryDayDraft[],
  summaries?: VipClientSummaryPatch,
): unknown {
  const daysArray = buildDaysDataForSave(days);
  const patch = summaries ?? { weather_summary: null };
  const hasAny = Object.values(patch).some((v) => Boolean(v?.trim()));
  if (!hasAny) return daysArray;
  return {
    __vip_summaries: patch,
    days: daysArray,
  };
}

const SCHEMA_OPTIONAL_ITINERARY_COLUMNS = [
  'expert_id',
  'expert_name',
  'trip_type',
  'group_name',
  'total_price',
  'total_budget',
  'spent_amount',
  'destination_story',
  'taxi_phrase',
  'secret_gem',
  'weather_summary',
  'packing_summary',
  'budget_summary',
  'flight_summary',
  'created_by_employee_id',
  'include_wardrobe',
  'unlock_secret_guide',
  'quote_id',
  'magic_link_id',
  'supplier_requests',
  'ticket_details',
  'documents',
  'is_template',
  'status',
  'start_date',
  'end_date',
] as const;

/** يزيل من الحمولة الأعمدة المذكورة صراحةً في رسالة خطأ Supabase فقط */
export function stripItineraryPayloadForSchemaError(
  errMsg: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  for (const col of SCHEMA_OPTIONAL_ITINERARY_COLUMNS) {
    if (new RegExp(col, 'i').test(errMsg)) {
      delete next[col];
    }
  }
  const expertId =
    payload.expert_id != null ? String(payload.expert_id).trim() : '';
  const expertName =
    payload.expert_name != null ? String(payload.expert_name).trim() : '';
  // Keep expert identity inside JSONB even when column write fails
  if (
    (/expert_id|expert_name/i.test(errMsg) || next.expert_id == null) &&
    (expertId || expertName)
  ) {
    next.days_data = withItineraryExpertMeta(
      next.days_data ?? payload.days_data,
      expertId || null,
      expertName || null,
    );
    const prevFlight =
      next.flight_details &&
      typeof next.flight_details === 'object' &&
      !Array.isArray(next.flight_details)
        ? { ...(next.flight_details as Record<string, unknown>) }
        : {};
    if (expertId) prevFlight.expert_id = expertId;
    if (expertName) prevFlight.expert_name = expertName;
    next.flight_details = prevFlight;
  }
  return next;
}

/** Embed expert id/name into days_data JSONB (survives missing expert_* columns). */
export function withItineraryExpertMeta(
  daysData: unknown,
  expertId?: string | null,
  expertName?: string | null,
): unknown {
  const id = String(expertId ?? '').trim();
  const name = String(expertName ?? '').trim();
  if (!id && !name) return daysData;

  const metaPatch: Record<string, string> = {};
  if (id) metaPatch.expert_id = id;
  if (name) metaPatch.expert_name = name;

  if (Array.isArray(daysData)) {
    return { days: daysData, meta: metaPatch };
  }
  if (daysData && typeof daysData === 'object') {
    const obj = daysData as Record<string, unknown>;
    const prevMeta =
      obj.meta && typeof obj.meta === 'object' && !Array.isArray(obj.meta)
        ? { ...(obj.meta as Record<string, unknown>) }
        : {};
    return { ...obj, meta: { ...prevMeta, ...metaPatch } };
  }
  return { days: [], meta: metaPatch };
}

/** Resolve display name for Routes Command Center cards */
export function readItineraryExpertDisplayName(row: {
  expert_name?: unknown;
  expert_id?: unknown;
  days_data?: unknown;
  flight_details?: unknown;
  experts?: unknown;
  expert?: unknown;
}): string {
  const direct = String(row.expert_name ?? '').trim();
  if (direct) return direct;

  for (const embedRaw of [row.experts, row.expert]) {
    const embed = Array.isArray(embedRaw) ? embedRaw[0] : embedRaw;
    if (embed && typeof embed === 'object') {
      const embedName =
        String((embed as { name?: unknown }).name ?? '').trim() ||
        String((embed as { full_name?: unknown }).full_name ?? '').trim();
      if (embedName) return embedName;
    }
  }

  const flight = row.flight_details;
  if (flight && typeof flight === 'object' && !Array.isArray(flight)) {
    const fromFlight = String((flight as { expert_name?: unknown }).expert_name ?? '').trim();
    if (fromFlight) return fromFlight;
  }

  const daysData = row.days_data;
  if (daysData && typeof daysData === 'object' && !Array.isArray(daysData)) {
    const meta = (daysData as { meta?: unknown }).meta;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const metaName = String((meta as { expert_name?: unknown }).expert_name ?? '').trim();
      if (metaName) return metaName;
    }
  }

  return '';
}

export function readItineraryExpertId(row: {
  expert_id?: unknown;
  days_data?: unknown;
  flight_details?: unknown;
}): string {
  const direct = String(row.expert_id ?? '').trim();
  if (direct) return direct;

  const flight = row.flight_details;
  if (flight && typeof flight === 'object' && !Array.isArray(flight)) {
    const fromFlight = String((flight as { expert_id?: unknown }).expert_id ?? '').trim();
    if (fromFlight) return fromFlight;
  }

  const daysData = row.days_data;
  if (daysData && typeof daysData === 'object' && !Array.isArray(daysData)) {
    const meta = (daysData as { meta?: unknown }).meta;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return String((meta as { expert_id?: unknown }).expert_id ?? '').trim();
    }
  }
  return '';
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
  const currency = b.currency.trim() || null;
  return { currency };
}

export function buildFlightDetailsPayload(f: FlightDetailsDraft): Record<string, string> {
  const from = f.flight_from.trim();
  const to = f.flight_to.trim();
  const seat = f.flight_seat.trim();
  const departure = (f.departure_time || f.flight_time).trim();
  const arrival = f.arrival_time.trim();
  const gate = f.gate.trim() || f.terminal.trim();
  const pnr = f.booking_reference.trim();
  const payload: Record<string, string> = {
    flight_from: from,
    flight_to: to,
    from_city: from,
    to_city: to,
    flight_number: f.flight_number.trim(),
    flight_seat: seat,
    seat,
    flight_time: departure,
    leave_home_time: departure,
    departure_time: departure,
    arrival_time: arrival,
    landing_time: arrival,
    gate,
    destination_flag: f.destination_flag.trim(),
    airport: f.airport.trim(),
    terminal: f.terminal.trim(),
    flight_class: f.flight_class.trim(),
    departure_country: f.departure_country.trim(),
    arrival_country: f.arrival_country.trim(),
  };
  if (pnr) {
    payload.booking_reference = pnr;
    payload.pnr = pnr;
  }
  return payload;
}

export function resolveDestination(draft: ItineraryDraft): string | null {
  const d = draft.destination.trim() || draft.flight.flight_to.trim();
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
  const vipSummaries = buildVipClientSummaryPatch(draft);
  const days_data = buildDaysDataPayloadForSave(draft.days, vipSummaries);
  const hotel_details = buildHotelDetailsForSave(draft);
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

  const isGroupTrip = draft.tripMode === 'Group';
  // رحلة خاصة: client_id إلزامي · رحلة جماعية: قالب مستقل بلا client_id
  const organizerId = isGroupTrip
    ? null
    : coerceClientIdForItinerarySave(draft.linkedClientId);

  const payload: Record<string, unknown> = {
    customer_name: isGroupTrip
      ? draft.groupName.trim() || draft.customerName.trim() || 'رحلة جماعية'
      : draft.customerName.trim() || (options.isTemplate ? 'قالب جاهز' : ''),
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
    ...(passcode ? { passcode } : {}),
    ...(hotel_details.length > 0 ? { hotel_details } : {}),
    ...(experiences_details.length > 0 ? { experiences_details } : {}),
    include_wardrobe: draft.includeWardrobe,
    unlock_secret_guide: draft.unlockSecretGuide,
    trip_type: draft.tripMode,
    group_name: isGroupTrip ? draft.groupName.trim() : null,
    client_id: organizerId,
    quote_id: null,
    ...(parsedTotalPrice != null ? { total_price: parsedTotalPrice } : {}),
    total_budget,
    spent_amount,
    destination_story: draft.discover.destinationStory.trim() || null,
    taxi_phrase: draft.discover.taxiPhrase.trim() || null,
    secret_gem: draft.discover.secretGem.trim() || null,
    ...vipSummaries,
    ...(options.employeeId ? { created_by_employee_id: options.employeeId } : {}),
  };

  applyItineraryTripDatesToPayload(payload, draft.datesFrom, draft.datesTo, {
    resetStatusWhenFuture: !options.isTemplate,
  });

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

/** Prefer start_date/end_date columns, fall back to legacy `dates` text. */
export function resolveTripDatesFromRow(row: Record<string, unknown>): {
  from: string;
  to: string;
} {
  const fromCol = normalizeIsoDateOnly(
    row.start_date != null ? String(row.start_date) : '',
  );
  const toCol = normalizeIsoDateOnly(row.end_date != null ? String(row.end_date) : '');
  if (fromCol || toCol) {
    return { from: fromCol, to: toCol || fromCol };
  }
  return parseDatesField(row.dates);
}

export function importDaysFromTemplate(templateDaysRaw: unknown): ItineraryDayDraft[] {
  const { days: templateDays } = parseDaysDataFromRow(templateDaysRaw);
  if (!Array.isArray(templateDays) || templateDays.length === 0) {
    return [createEmptyDay(0)];
  }

  return (templateDays as Array<Record<string, unknown>>).map((d, idx) => {
    const rawStops = Array.isArray(d.stops)
      ? d.stops
      : Array.isArray(d.itinerary_stops)
        ? d.itinerary_stops
        : [];
    const stops: ItineraryStopDraft[] =
      rawStops.length > 0
        ? rawStops.map((raw, si) => {
            const s = raw as Record<string, unknown>;
            const legacyTransport = String(
              s.transport_type ?? s.taxi ?? s.transit_to_next ?? '',
            ).trim();
            const transit_mode = normalizeTransitMode(s.transit_mode ?? legacyTransport);
            const transit_duration = String(
              s.transit_duration ?? s.transit_time ?? '',
            ).trim();
            return {
              id: newLocalId(),
              place_name: String(s.place_name ?? s.name ?? '').trim(),
              visit_time: resolveVisitTime(s),
              time_slot: resolveVisitTime(s),
              note: String(s.note ?? '').trim(),
              story: String(s.story ?? s.description ?? '').trim(),
              transport_type: legacyTransport,
              transit_mode,
              transit_duration,
              maps_url: String(s.maps_url ?? s.google_maps_url ?? '').trim(),
              booking_url: String(s.booking_url ?? '').trim(),
              lat: s.lat != null ? String(s.lat) : s.latitude != null ? String(s.latitude) : '',
              lng: s.lng != null ? String(s.lng) : s.longitude != null ? String(s.longitude) : '',
              category: String(s.category ?? 'o').trim() || 'o',
              places_bank_id: String(s.places_bank_id ?? '').trim() || undefined,
            };
          })
        : [];

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

    const baseDay: ItineraryDayDraft = {
      id: `day-import-${Date.now()}-${idx}`,
      title: String(d.title ?? '').trim() || `اليوم ${dayLabel(idx)}`,
      city: String(d.city ?? '').trim(),
      notes: String(d.notes ?? '').trim(),
      stops,
      activities: [],
      hotel: (d.hotel as HotelRow | null) ?? null,
      alternative_hotels,
      experience: (d.experience as ExperienceRow | null) ?? null,
    };
    return patchDayActivities(baseDay, dayToActivities(baseDay));
  });
}

/** أعمدة أساسية — بدون علاقات متداخلة (احتياط عند فشل المخطط) */
export const ITINERARY_BUILDER_CORE_SELECT = [
  'id',
  'customer_name',
  'title',
  'dates',
  'passcode',
  'magic_link_id',
  'client_id',
  'quote_id',
  'days_data',
  'destination',
  'flight_details',
  'weather_temp',
  'highlights',
  'budget_options',
  'total_budget',
  'spent_amount',
  'total_price',
  'destination_story',
  'taxi_phrase',
  'secret_gem',
  'local_lingo',
  'include_wardrobe',
  'unlock_secret_guide',
  'weather_summary',
  'trip_type',
  'group_name',
].join(', ');

/** جلب مع أيام legacy من itinerary_days */
export const ITINERARY_BUILDER_LEGACY_DAYS_SELECT = [
  ITINERARY_BUILDER_CORE_SELECT,
  'itinerary_days ( id, day_num, title, city, notes, sort_order, itinerary_stops ( id, place_name, category, visit_time, time_slot, note, image_url, transport_type, taxi, transit_mode, transit_duration, transit_distance, sort_order ) )',
].join(', ');

export const ITINERARY_BUILDER_ROW_SELECT = ITINERARY_BUILDER_LEGACY_DAYS_SELECT;

function isSchemaColumnError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  return /column|schema cache|does not exist|relationship/.test(m);
}

function parseJsonObjectField(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      console.error('[itinerary-builder] JSON object parse failed', e);
    }
  }
  return null;
}

function parseJsonArrayField(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[itinerary-builder] JSON array parse failed', e);
      return [];
    }
  }
  return [];
}

/** يطبّع صف DB قبل التحويل إلى مسودة المنشئ */
export function normalizeItineraryRowForBuilder(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };

  const fd = parseJsonObjectField(row.flight_details);
  if (fd) next.flight_details = fd;

  const bo = parseJsonObjectField(row.budget_options);
  if (bo) next.budget_options = bo;

  if (row.days_data != null) {
    next.days_data = row.days_data;
  } else if (row.days != null) {
    next.days_data = row.days;
  }

  const highlights = parseJsonArrayField(row.highlights);
  if (highlights.length > 0 || typeof row.highlights === 'string') {
    next.highlights = highlights;
  }

  const lingo = parseJsonArrayField(row.local_lingo);
  if (lingo.length > 0 || typeof row.local_lingo === 'string') {
    next.local_lingo = lingo;
  }

  return next;
}

function resolveBuilderQueryId(editId: string): string | number {
  const trimmed = editId.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function rowHasHydratableDays(row: Record<string, unknown>): boolean {
  const { days } = parseDaysDataFromRow(row.days_data ?? row.days);
  if (days.length > 0) return true;
  const legacy = row.itinerary_days;
  return Array.isArray(legacy) && legacy.length > 0;
}

/** جلب صف مسار للتحرير — محاولات متدرجة + أيام legacy */
export async function fetchItineraryRowForBuilder(
  supabase: { from: (table: string) => unknown },
  editId: string,
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  const idValue = resolveBuilderQueryId(editId);
  const selects = [ITINERARY_BUILDER_LEGACY_DAYS_SELECT, ITINERARY_BUILDER_CORE_SELECT];

  let lastError: string | null = null;

  for (const select of selects) {
    const qb = supabase.from('itineraries') as {
      select: (s: string) => {
        eq: (col: string, val: string | number) => {
          maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
    const { data, error } = await qb.select(select).eq('id', idValue).maybeSingle();

    if (data && typeof data === 'object') {
      const row = normalizeItineraryRowForBuilder(data as Record<string, unknown>);
      if (!rowHasHydratableDays(row)) {
        const legacyOnly = await qb
          .select(
            `id, itinerary_days ( id, day_num, title, city, notes, sort_order, itinerary_stops ( id, place_name, category, visit_time, time_slot, note, image_url, transport_type, taxi, transit_mode, transit_duration, sort_order ) )`,
          )
          .eq('id', idValue)
          .maybeSingle();
        if (legacyOnly.data && typeof legacyOnly.data === 'object') {
          const legacyRow = legacyOnly.data as Record<string, unknown>;
          if (Array.isArray(legacyRow.itinerary_days)) {
            row.itinerary_days = legacyRow.itinerary_days;
          }
        }
      }
      return { row, error: null };
    }

    if (error?.message) {
      lastError = error.message;
      if (!isSchemaColumnError(error.message)) {
        return { row: null, error: error.message };
      }
    }
  }

  return { row: null, error: lastError ?? 'تعذر تحميل المسار للتحرير.' };
}

export function importDaysFromLegacyRelational(
  rawDays: Array<Record<string, unknown>> | null | undefined,
): ItineraryDayDraft[] {
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return [createEmptyDay(0)];
  }

  const sorted = [...rawDays].sort(
    (a, b) => Number(a.sort_order ?? a.day_num ?? 0) - Number(b.sort_order ?? b.day_num ?? 0),
  );

  return sorted.map((d, idx) => {
    const stopsRaw = Array.isArray(d.itinerary_stops)
      ? [...(d.itinerary_stops as Array<Record<string, unknown>>)]
      : [];
    stopsRaw.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    const stops: ItineraryStopDraft[] =
      stopsRaw.length > 0
        ? stopsRaw.map((s) => {
            const legacyTransport = String(s.transport_type ?? s.taxi ?? '').trim();
            return {
              id: newLocalId(),
              place_name: String(s.place_name ?? s.name ?? '').trim(),
              visit_time: resolveVisitTime(s),
              time_slot: resolveVisitTime(s),
              note: String(s.note ?? '').trim(),
              story: String(s.story ?? s.description ?? '').trim(),
              transport_type: legacyTransport,
              transit_mode: normalizeTransitMode(s.transit_mode ?? legacyTransport),
              transit_duration: String(s.transit_duration ?? '').trim(),
              maps_url: String(s.maps_url ?? s.google_maps_url ?? '').trim(),
              booking_url: String(s.booking_url ?? '').trim(),
              lat: s.lat != null ? String(s.lat) : s.latitude != null ? String(s.latitude) : '',
              lng: s.lng != null ? String(s.lng) : s.longitude != null ? String(s.longitude) : '',
              category: String(s.category ?? 'o').trim() || 'o',
              places_bank_id: String(s.places_bank_id ?? '').trim() || undefined,
              image_url: String(s.image_url ?? s.photo ?? s.thumbnail_url ?? '').trim(),
            };
          })
        : [];

    const baseDay: ItineraryDayDraft = {
      id: `day-legacy-${idx}-${newLocalId()}`,
      title: String(d.title ?? '').trim() || `اليوم ${dayLabel(idx)}`,
      city: String(d.city ?? '').trim(),
      notes: String(d.notes ?? '').trim(),
      stops,
      activities: [],
      hotel: (d.hotel as HotelRow | null) ?? null,
      alternative_hotels: [],
      experience: (d.experience as ExperienceRow | null) ?? null,
    };
    return patchDayActivities(baseDay, dayToActivities(baseDay));
  });
}

/** يملأ مسودة المنشئ من صف itineraries (days_data أو جداول itinerary_days القديمة) */
export function draftFromItineraryRow(
  row: Record<string, unknown>,
  legacyDays?: Array<Record<string, unknown>> | null,
): ItineraryDraft {
  const normalized = normalizeItineraryRowForBuilder(row);
  const base = createInitialItineraryDraft();
  const partial = draftFromTemplate(normalized);

  const daysRaw = normalized.days_data ?? normalized.days;
  const { days: parsedFromJson } = parseDaysDataFromRow(daysRaw);
  let days: ItineraryDayDraft[];
  if (parsedFromJson.length > 0) {
    days = importDaysFromTemplate(daysRaw);
  } else if (legacyDays && legacyDays.length > 0) {
    days = importDaysFromLegacyRelational(legacyDays);
  } else if (Array.isArray(normalized.itinerary_days) && normalized.itinerary_days.length > 0) {
    days = importDaysFromLegacyRelational(
      normalized.itinerary_days as Array<Record<string, unknown>>,
    );
  } else {
    days = partial.days ?? [createEmptyDay(0)];
  }

  const fd = parseJsonObjectField(normalized.flight_details) ?? {};
  const flight: FlightDetailsDraft = {
    flight_from: String(
      fd.flight_from ?? fd.from_city ?? (normalized.flight_from as string) ?? '',
    ).trim(),
    flight_to: String(fd.flight_to ?? fd.to_city ?? (normalized.flight_to as string) ?? '').trim(),
    flight_number: String(
      fd.flight_number ?? (normalized.flight_number as string) ?? '',
    ).trim(),
    flight_seat: String(fd.flight_seat ?? fd.seat ?? (normalized.flight_seat as string) ?? '').trim(),
    departure_time: String(
      fd.departure_time ?? fd.flight_time ?? fd.leave_home_time ?? '',
    ).trim(),
    flight_time: String(
      fd.flight_time ??
        fd.leave_home_time ??
        fd.departure_time ??
        (normalized.flight_time as string) ??
        '',
    ).trim(),
    arrival_time: String(
      fd.arrival_time ?? fd.landing_time ?? (normalized.arrival_time as string) ?? '',
    ).trim(),
    gate: String(fd.gate ?? fd.terminal ?? '').trim(),
    booking_reference: String(
      fd.booking_reference ?? fd.pnr ?? fd.record_locator ?? '',
    ).trim(),
    destination_flag: String(fd.destination_flag ?? '').trim(),
    airport: String(fd.airport ?? '').trim(),
    terminal: String(fd.terminal ?? '').trim(),
    flight_class: String(fd.flight_class ?? fd.flightClass ?? '').trim(),
    departure_country: String(
      fd.departure_country ?? fd.departureCountry ?? '',
    ).trim(),
    arrival_country: String(fd.arrival_country ?? fd.arrivalCountry ?? '').trim(),
  };

  const tripType = String(normalized.trip_type ?? 'Individual').trim();
  const tripMode: ItineraryDraft['tripMode'] = tripType === 'Group' ? 'Group' : 'Individual';

  const formatBudgetField = (v: unknown) =>
    v != null && v !== '' ? String(v) : '';

  const primaryHotel = primaryHotelFromHotelDetailsRaw(
    normalized.hotel_details ?? partial.primaryHotel,
  );

  return {
    ...base,
    ...partial,
    days,
    flight,
    primaryHotel,
    passcode: String(normalized.passcode ?? '').trim(),
    linkedClientId: normalized.client_id != null ? String(normalized.client_id) : '',
    tripMode,
    groupName: String(normalized.group_name ?? '').trim(),
    budgetTracking: {
      totalPrice: formatBudgetField(normalized.total_price),
      totalBudget: formatBudgetField(normalized.total_budget),
      spentAmount: formatBudgetField(normalized.spent_amount),
    },
  };
}

export function draftFromTemplate(template: Record<string, unknown>): Partial<ItineraryDraft> {
  const bo = parseJsonObjectField(template.budget_options) as BudgetOptionsPayload | null;
  const fd = parseJsonObjectField(template.flight_details);
  const { from, to } = parseDatesField(template.dates);

  const budgetOptions: BudgetOptionsDraft = {
    currency: bo?.currency ? String(bo.currency) : 'SAR',
  };

  const summaryFields = extractVipSummaryFields(template);

  return {
    customerName: String(template.customer_name ?? '').trim(),
    title: String(template.title ?? '').trim(),
    datesFrom: from,
    datesTo: to,
    destination: String(template.destination ?? '').trim(),
    flight: {
      flight_from: String(fd?.flight_from ?? fd?.from_city ?? '').trim(),
      flight_to: String(fd?.flight_to ?? fd?.to_city ?? '').trim(),
      flight_number: String(fd?.flight_number ?? '').trim(),
      flight_seat: String(fd?.flight_seat ?? fd?.seat ?? '').trim(),
      departure_time: String(
        fd?.departure_time ?? fd?.flight_time ?? fd?.leave_home_time ?? '',
      ).trim(),
      flight_time: String(
        fd?.flight_time ?? fd?.leave_home_time ?? fd?.departure_time ?? '',
      ).trim(),
      arrival_time: String(fd?.arrival_time ?? fd?.landing_time ?? '').trim(),
      gate: String(fd?.gate ?? fd?.terminal ?? '').trim(),
      booking_reference: String(
        fd?.booking_reference ?? fd?.pnr ?? fd?.record_locator ?? '',
      ).trim(),
      destination_flag: String(fd?.destination_flag ?? '').trim(),
      airport: String(fd?.airport ?? '').trim(),
      terminal: String(fd?.terminal ?? '').trim(),
      flight_class: String(fd?.flight_class ?? fd?.flightClass ?? '').trim(),
      departure_country: String(
        fd?.departure_country ?? fd?.departureCountry ?? '',
      ).trim(),
      arrival_country: String(fd?.arrival_country ?? fd?.arrivalCountry ?? '').trim(),
    },
    weatherTemp: template.weather_temp != null ? String(template.weather_temp) : '',
    highlights: parseJsonArrayField(template.highlights) as string[],
    budgetOptions,
    discover: {
      destinationStory: String(template.destination_story ?? '').trim(),
      taxiPhrase: String(template.taxi_phrase ?? '').trim(),
      secretGem: String(template.secret_gem ?? '').trim(),
    },
    localLingo: parseJsonArrayField(template.local_lingo)
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((r) => ({
        id: newLocalId(),
        arabic_word: String(r.arabic_word ?? ''),
        local_word: String(r.local_word ?? ''),
      })),
    days: importDaysFromTemplate(template.days_data ?? template.days),
    // Fashion/wardrobe module removed — never re-enable from saved rows
    includeWardrobe: false,
    unlockSecretGuide: template.unlock_secret_guide === true,
    weatherSummary: String(
      template.weather_summary ?? summaryFields.weather_summary ?? '',
    ).trim(),
  };
}
