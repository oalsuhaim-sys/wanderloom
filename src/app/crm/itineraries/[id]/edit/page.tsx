'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, MessageCircle, Plus, Trash2, Copy, FileStack, FileText, Upload } from 'lucide-react';
import { DragDropContext } from '@hello-pangea/dnd';

import SimpleItineraryDayPlanner from '@/app/crm/itineraries/_components/SimpleItineraryDayPlanner';
import SupplierRequestsEditor from '@/app/crm/itineraries/_components/SupplierRequestsEditor';
import SimpleItineraryPlacesBank from '@/app/crm/itineraries/_components/SimpleItineraryPlacesBank';
import TripGeographySelectors from '@/app/crm/itineraries/_components/TripGeographySelectors';
import ItineraryHotelsEditor from '@/app/crm/itineraries/_components/ItineraryHotelsEditor';
import ActivityTicketsEditor from '@/app/crm/itineraries/_components/ActivityTicketsEditor';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { QuickAddPlaceModal, useQuickAddPlace } from '@/app/crm/itineraries/_components/useQuickAddPlace';
import {
  createEmptyDay,
  createEmptyHotelEntry,
  parseHotelsFromDetailsRaw,
  hotelsToDetailsPayload,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { useSimpleItineraryDays } from '@/app/crm/itineraries/_components/useSimpleItineraryDays';
import { buildStrictSimpleItinerarySavePayload, normalizeItinerarySaveStatus, parseDatesField } from '@/lib/itinerary-builder-model';
import {
  applyTemplateToBuilder,
  buildTemplateFlightDetails,
  fetchItineraryTemplates,
  saveItineraryTemplate,
  type ItineraryTemplateRow,
} from '@/lib/itinerary-templates';
import {
  parseItineraryDocuments,
  uploadItineraryPdf,
  type ItineraryDocument,
} from '@/lib/itinerary-documents';
import { parseDaysDataFromRow, emptyPreTripService, parsePreTripServices, itineraryHasMedicalPreTrip, type PreTripService } from '@/lib/public-itinerary';
import {
  buildSupplierBriefClientContext,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';
import { parseSupplierRequests, type SupplierRequest } from '@/lib/supplier-requests';
import { parseActivityTickets, type ActivityTicket } from '@/lib/itinerary-tickets';
import {
  fetchCrmSuppliers,
  type CrmSupplier,
} from '@/lib/crm-suppliers';
import {
  buildDestinationSummary,
  filterPlacesByCities,
  filterSuppliersByCountries,
  parseItineraryGeography,
  type GeoTripType,
} from '@/lib/itinerary-geography';
import {
  clientDisplayName,
  CRM_CLIENTS_LIST_SELECT,
  ITINERARY_CLIENT_JOIN_SELECT,
  mergeClientIntoList,
  openItineraryWhatsAppShare,
  parseJoinedCrmClient,
  resolveItineraryClientId,
  resolveItineraryPublicSlug,
  type CrmClientMini,
} from '@/lib/itinerary-client-crm';
import { supabase } from '@/lib/supabase';

const CLIENT_BRIEF_SELECT =
  'id, name, travel_dna, hotel_preferences, dietary, secret_notes';
const CLIENT_BRIEF_SELECT_MIN = 'id, name';

function formatSupabaseSaveError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  const parts = [error.message, error.details, error.hint, error.code ? `(${error.code})` : '']
    .filter(Boolean)
    .join(' — ');
  const msg = parts || 'فشل الحفظ.';
  if (/column|schema|does not exist|permission|RLS|policy|42501|42703/i.test(msg)) {
    return `${msg} — تحقق من عمود days_data (JSONB) وصلاحيات RLS في Supabase.`;
  }
  return msg;
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function transitModeToArabic(mode: unknown): string {
  const m = String(mode ?? '').toLowerCase();
  if (m.includes('walk') || m === 'walking' || m === 'مشي') return 'مشي';
  if (m.includes('metro') || m.includes('train') || m.includes('subway') || m === 'مترو')
    return 'مترو';
  return 'سيارة';
}

function arabicTransportToMode(value: string): string {
  if (value === 'مشي') return 'walking';
  if (value === 'مترو') return 'metro';
  return 'car';
}

function daysDataToItineraryDays(raw: unknown): SimpleItineraryDay[] {
  const { days: parsed } = parseDaysDataFromRow(raw);
  if (!parsed.length) {
    return [createEmptyDay(0)];
  }

  return parsed.map((d: Record<string, unknown>, idx: number) => {
    const row = d;
    if (Array.isArray(row.places) && row.places.length >= 0) {
      return {
        id: typeof row.id === 'number' ? row.id : Date.now() + idx,
        title: String(row.title ?? `اليوم ${idx + 1}`),
        city: String(row.city ?? '').trim() || undefined,
        hotelName: String(row.hotelName ?? row.hotel_name ?? '').trim() || undefined,
        places: (row.places as any[]).map(withTransportDefaults),
      };
    }

    const stops = (row.itinerary_stops ?? row.stops ?? []) as Array<Record<string, unknown>>;
    const places = stops.map((s) =>
      withTransportDefaults({
        id: s.places_bank_id ?? s.id,
        name: String(s.place_name ?? s.name ?? 'محطة').trim(),
        category: s.category,
        city: row.city ?? s.city,
        rating: s.rating,
        transportToNext: transitModeToArabic(s.transit_mode ?? s.transport_type),
        transportDuration: String(s.transit_duration ?? '').trim(),
      }),
    );

    return {
      id: typeof row.id === 'number' ? row.id : Date.now() + idx,
      title: String(row.title ?? `اليوم ${idx + 1}`),
      city: String(row.city ?? '').trim() || undefined,
      hotelName:
        String(row.hotelName ?? row.hotel_name ?? (row.hotel as { name?: string } | undefined)?.name ?? '')
          .trim() || undefined,
      places,
    };
  });
}

function itineraryDaysToDaysData(days: SimpleItineraryDay[]): unknown[] {
  return days.map((day, idx) => {
    const places = day.places.map(withTransportDefaults);
    const itinerary_stops = places.map((p, placeIndex) => ({
      sort_order: placeIndex + 1,
      place_name: p.name,
      category: p.category,
      places_bank_id: p.id != null ? String(p.id) : undefined,
      ...(placeIndex > 0
        ? {
            transit_mode: arabicTransportToMode(p.transportToNext ?? 'سيارة'),
            transit_duration: p.transportDuration ?? '',
          }
        : {}),
    }));

    return {
      day_number: idx + 1,
      id: day.id,
      title: day.title,
      ...(day.city ? { city: day.city.trim() } : {}),
      ...(day.hotelName ? { hotelName: day.hotelName, hotel_name: day.hotelName } : {}),
      places: places.map((p) => ({ ...p })),
      itinerary_stops,
      stops: itinerary_stops,
    };
  });
}

function resolveRouteId(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return undefined;
}

type DaysStorageKey =
  | 'days_json'
  | 'itinerary_days'
  | 'days'
  | 'plan_json'
  | 'days_data'
  | 'relational';

const DAYS_COLUMN_PRIORITY: DaysStorageKey[] = [
  'days_json',
  'plan_json',
  'days_data',
  'days',
  'itinerary_days',
];

function pickFirstDefined(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

function strField(obj: Record<string, unknown>, keys: string[]): string {
  const v = pickFirstDefined(obj, keys);
  return v != null ? String(v).trim() : '';
}

const EDIT_HEADER_FIELD =
  'w-full rounded-lg border border-gray-200 bg-gray-50 p-3 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/50 text-gray-900';

function normalizeBuilderDays(parsed: unknown): SimpleItineraryDay[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const days = daysDataToItineraryDays(parsed);
  const hasContent = days.some((d) => d.places.length > 0);
  const hasTitles = days.some((d) => d.title && d.title !== 'اليوم الأول');
  if (hasContent || hasTitles || days.length > 1) return days;
  if (days.length === 1 && days[0]?.places.length === 0) {
    const first = parsed[0] as Record<string, unknown>;
    if (!first?.title && !first?.places && !first?.itinerary_stops && !first?.stops) {
      return null;
    }
  }
  return days;
}

function detectDaysSource(
  safeData: Record<string, unknown>,
): { raw: unknown; key: DaysStorageKey } | null {
  for (const key of DAYS_COLUMN_PRIORITY) {
    const raw = safeData[key];
    if (raw == null || raw === '') continue;
    if (key === 'itinerary_days' && Array.isArray(raw) && raw.length === 0) continue;
    return { raw, key };
  }
  return null;
}

export default function EditItineraryPage() {
  const params = useParams();
  const id = resolveRouteId(params?.id as string | string[] | undefined);

  const [places, setPlaces] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<CrmClientMini[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [itineraryShareSlug, setItineraryShareSlug] = useState('');
  const [supplierBrief, setSupplierBrief] = useState<SupplierBriefClientContext | null>(null);
  const [accessCode, setAccessCode] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [flightArrivalCity, setFlightArrivalCity] = useState('');
  const [tripTitle, setTripTitle] = useState('');
  const [geoTripType, setGeoTripType] = useState<GeoTripType>('single');
  const [tripCountries, setTripCountries] = useState<string[]>([]);
  const [tripCities, setTripCities] = useState<string[]>([]);
  const [customCitiesText, setCustomCitiesText] = useState('');
  const [tripDateFrom, setTripDateFrom] = useState('');
  const [tripDateTo, setTripDateTo] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [budget, setBudget] = useState('');
  const [paid, setPaid] = useState('');
  const remaining = (Number(budget) || 0) - (Number(paid) || 0);

  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [gate, setGate] = useState('');
  const [seat, setSeat] = useState('');
  const [pnr, setPnr] = useState('');
  const [hotels, setHotels] = useState<ItineraryHotelEntry[]>([createEmptyHotelEntry()]);
  const [preTripServices, setPreTripServices] = useState<PreTripService[]>([]);

  const [templates, setTemplates] = useState<ItineraryTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateSaveTitle, setTemplateSaveTitle] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templatesNotice, setTemplatesNotice] = useState('');
  const [expectedProfit, setExpectedProfit] = useState('');
  const [includeFashionServices, setIncludeFashionServices] = useState(false);
  const [documents, setDocuments] = useState<ItineraryDocument[]>([]);
  const [supplierRequests, setSupplierRequests] = useState<SupplierRequest[]>([]);
  const [activityTickets, setActivityTickets] = useState<ActivityTicket[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<CrmSupplier[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [tripStatus, setTripStatus] = useState('active');

  const {
    itineraryDays,
    setItineraryDays,
    activeDayId,
    setActiveDayId,
    activeDayLabel,
    handleAddDay,
    handleAddPlace,
    handleRemovePlace,
    updateTransport,
    updateDayHotel,
    updateDayCity,
    onDragEnd,
    dayDroppableId,
  } = useSimpleItineraryDays([createEmptyDay(0)]);

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const daysStorageKeyRef = useRef<DaysStorageKey>('days_data');
  const pinnedClientRef = useRef<CrmClientMini | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      if (!supabase) return;

      try {
        const allPlaces: any[] = [];
        for (let offset = 0; offset < 10_000; offset += 1000) {
          const { data: placesData, error } = await supabase
            .from('places')
            .select('*')
            .order('name', { ascending: true })
            .range(offset, offset + 999);

          if (error) {
            console.error('Failed to load places', error);
            break;
          }
          if (!placesData?.length) break;
          allPlaces.push(...placesData);
          if (placesData.length < 1000) break;
        }
        setPlaces(allPlaces as any[]);

        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select(CRM_CLIENTS_LIST_SELECT)
          .order('name', { ascending: true });

        if (clientsError) {
          console.error('Failed to load clients', clientsError);
        } else {
          const loaded = (clientsData as CrmClientMini[]) ?? [];
          setClientsList(
            pinnedClientRef.current
              ? mergeClientIntoList(loaded, pinnedClientRef.current)
              : loaded,
          );
        }

        try {
          const { templates: loaded, usedFallback } = await fetchItineraryTemplates(supabase);
          setTemplates(loaded);
          if (usedFallback) {
            setTemplatesNotice('القوالب تُحمّل من itineraries (is_template) — نفّذ itinerary_templates.sql للجدول المخصص.');
          }
        } catch (templateErr) {
          console.error('Failed to load templates', templateErr);
        }

        try {
          const supplierRows = await fetchCrmSuppliers(supabase);
          setAllSuppliers(supplierRows);
        } catch (supplierErr) {
          console.error('Failed to load suppliers', supplierErr);
        }
      } catch (error) {
        console.error('Data loading error:', error);
      }
    }
    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadClientBrief() {
      if (!supabase || !selectedClientId) {
        setSupplierBrief(null);
        return;
      }

      const selectedClient = clientsList.find((c) => String(c.id) === String(selectedClientId));
      const fallbackName = String(selectedClient?.name ?? '').trim();

      let clientRow: Record<string, unknown> | null = null;
      let result = await supabase
        .from('clients')
        .select(CLIENT_BRIEF_SELECT)
        .eq('id', selectedClientId)
        .maybeSingle();

      if (result.error && /column|schema cache|does not exist/i.test(result.error.message ?? '')) {
        result = await supabase
          .from('clients')
          .select(CLIENT_BRIEF_SELECT_MIN)
          .eq('id', selectedClientId)
          .maybeSingle();
      }

      if (!result.error && result.data) {
        clientRow = result.data as Record<string, unknown>;
      }

      let interests: unknown = [];
      const prefsResult = await supabase
        .from('client_preferences')
        .select('interests')
        .eq('client_id', selectedClientId)
        .maybeSingle();
      if (!prefsResult.error && prefsResult.data) {
        interests = (prefsResult.data as { interests?: unknown }).interests;
      }

      setSupplierBrief(
        buildSupplierBriefClientContext({
          clientRow,
          interests,
          tripDateFrom,
          tripDateTo,
          destination: buildDestinationSummary(tripCities, tripCountries) || tripTitle,
          fallbackName,
        }),
      );
    }

    void loadClientBrief();
  }, [selectedClientId, tripDateFrom, tripDateTo, tripCities, tripCountries, tripTitle, clientsList]);

  useEffect(() => {
    async function fetchItinerary() {
      if (!id) {
        setIsLoading(false);
        return;
      }
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      try {
        const queryId = /^\d+$/.test(id) ? Number(id) : id;
        const { data, error } = await supabase
          .from('itineraries')
          .select(ITINERARY_CLIENT_JOIN_SELECT)
          .eq('id', queryId)
          .single();

        let safeData = data as Record<string, unknown> | null;
        if (error || !safeData) {
          const fallback = await supabase
            .from('itineraries')
            .select('*')
            .eq('id', queryId)
            .single();
          if (fallback.error || !fallback.data) {
            console.error('Fetch error:', error ?? fallback.error);
            setNotice(fallback.error?.message || error?.message || 'تعذر تحميل المسار.');
            return;
          }
          safeData = fallback.data as Record<string, unknown>;
        }

        const joinedClient = parseJoinedCrmClient(safeData.client);
        const resolvedClientId = resolveItineraryClientId(safeData);

        setItineraryShareSlug(resolveItineraryPublicSlug(safeData, id));
        setSelectedClientId(resolvedClientId);
        if (joinedClient) {
          pinnedClientRef.current = joinedClient;
          setClientsList((prev) => mergeClientIntoList(prev, joinedClient));
        }

        const fd = parseJsonObject(safeData.flight_details) ?? {};
        const geo = parseItineraryGeography(safeData, fd);

        setAccessCode(String(safeData.passcode ?? '').trim());
        setBudget(
          strField(safeData, ['budget', 'total_budget']) ||
            (safeData.total_budget != null ? String(safeData.total_budget) : ''),
        );
        setPaid(
          strField(safeData, ['paid', 'amount_paid', 'spent_amount']) ||
            (safeData.spent_amount != null ? String(safeData.spent_amount) : ''),
        );
        setOriginCity(
          strField(safeData, ['origin_city', 'origin']) ||
            strField(fd, ['flight_from', 'from_city']),
        );
        setGeoTripType(geo.geoTripType);
        setTripCountries(geo.countries);
        setTripCities(geo.cities);
        setTripTitle(String(safeData.title ?? '').trim());
        setFlightArrivalCity(
          normalizeSingleArrivalCity(strField(fd, ['flight_to', 'to_city'])),
        );
        const parsedTripDates = parseDatesField(safeData.dates);
        setTripDateFrom(parsedTripDates.from);
        setTripDateTo(parsedTripDates.to);

        const loadedDestination =
          buildDestinationSummary(geo.cities, geo.countries) ||
          strField(safeData, ['destination', 'destination_city']);

        setDepartureTime(
          strField(safeData, ['departure_time']) ||
            strField(fd, ['departure_time', 'flight_time']),
        );
        setArrivalTime(
          strField(safeData, ['arrival_time']) ||
            strField(fd, ['arrival_time', 'landing_time']),
        );
        setGate(strField(safeData, ['gate']) || strField(fd, ['gate', 'terminal']));
        setSeat(
          strField(safeData, ['seat']) || strField(fd, ['flight_seat', 'seat']),
        );
        setPnr(
          strField(safeData, ['pnr', 'booking_ref', 'booking_reference']) ||
            strField(fd, ['pnr', 'booking_reference']),
        );
        setHotels(parseHotelsFromDetailsRaw(safeData.hotel_details));
        setPreTripServices(parsePreTripServices(safeData.pre_trip_services));
        setExpectedProfit(
          safeData.expected_profit != null ? String(safeData.expected_profit) : '',
        );
        setIncludeFashionServices(safeData.include_wardrobe === true);
        setDocuments(parseItineraryDocuments(safeData.documents));
        setSupplierRequests(parseSupplierRequests(safeData.supplier_requests));
        setActivityTickets(parseActivityTickets(safeData.ticket_details));
        setTripStatus(normalizeItinerarySaveStatus(String(safeData.status ?? '')));
        setTemplateSaveTitle(loadedDestination || String(safeData.title ?? '').trim());

        let daysLoaded = false;
        const daysSource = detectDaysSource(safeData);

        if (daysSource) {
          daysStorageKeyRef.current =
            daysSource.key === 'itinerary_days' ? 'relational' : daysSource.key;

          try {
            let parsed: unknown =
              typeof daysSource.raw === 'string'
                ? JSON.parse(daysSource.raw)
                : daysSource.raw;

            if (
              parsed &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed) &&
              Array.isArray((parsed as { days?: unknown }).days)
            ) {
              parsed = (parsed as { days: unknown[] }).days;
            }

            const normalized = normalizeBuilderDays(parsed as unknown[]);
            if (normalized && normalized.length > 0) {
              setItineraryDays(normalized);
              daysLoaded = true;
            }
          } catch (e) {
            console.error('Error parsing itinerary days:', e);
            const fallback = normalizeBuilderDays(
              typeof daysSource.raw === 'string'
                ? (JSON.parse(daysSource.raw) as unknown[])
                : (daysSource.raw as unknown[]),
            );
            if (fallback?.length) {
              setItineraryDays(fallback);
              daysLoaded = true;
            }
          }
        }

        if (!daysLoaded) {
          const { data: relationalDays, error: daysError } = await supabase
            .from('itinerary_days')
            .select(
              `id, day_num, title, city, notes, sort_order,
              itinerary_stops (
                id, place_name, category, time_slot, note,
                transport_type, taxi, transit_mode, transit_duration,
                sort_order, places_bank_id
              )`,
            )
            .eq('itinerary_id', queryId)
            .order('sort_order', { ascending: true });

          if (daysError) {
            console.error('Relational itinerary_days fetch error:', daysError);
          } else if (relationalDays?.length) {
            daysStorageKeyRef.current = 'relational';
            const normalized = daysDataToItineraryDays(relationalDays);
            if (normalized.length > 0) {
              setItineraryDays(normalized);
              daysLoaded = true;
            }
          }
        }
      } catch (err) {
        console.error('Critical fetch error:', err);
        setNotice(err instanceof Error ? err.message : 'تعذر تحميل المسار.');
      } finally {
        setIsLoading(false);
      }
    }

    void fetchItinerary();
  }, [id]);

  const uniqueCities = useMemo(
    () =>
      Array.from(
        new Set(
          (tripCities.length ? tripCities : places.map((p) => p.city)).filter(Boolean),
        ),
      ),
    [tripCities, places],
  );
  const uniqueCategories = Array.from(new Set(places.map((p) => p.category).filter(Boolean)));

  const geographyDestinationLabel =
    buildDestinationSummary(tripCities, tripCountries) || tripTitle;

  const supplierDestinationLabel =
    tripCountries.join('، ') || geographyDestinationLabel || 'المختارة';

  const filteredSuppliers = useMemo(
    () =>
      filterSuppliersByCountries(allSuppliers, tripCountries, {
        destination: geographyDestinationLabel,
        cities: tripCities,
      }),
    [allSuppliers, tripCountries, tripCities, geographyDestinationLabel],
  );

  useEffect(() => {
    if (tripCities.length === 1) {
      setFilterCity(tripCities[0]!);
    } else if (tripCities.length === 0) {
      setFilterCity('');
    }
  }, [tripCities]);

  const displayedPlaces = useMemo(() => {
    const geoFiltered = filterPlacesByCities(places, tripCities);
    return geoFiltered.filter((place) => {
      const matchSearch =
        place.name?.includes(searchQuery) || place.city?.includes(searchQuery);
      const matchCity = filterCity ? place.city === filterCity : true;
      const matchCategory = filterCategory ? place.category === filterCategory : true;
      return matchSearch && matchCity && matchCategory;
    });
  }, [places, tripCities, searchQuery, filterCity, filterCategory]);

  const handleDragEnd = useCallback(
    (result: import('@hello-pangea/dnd').DropResult) => {
      onDragEnd(result, displayedPlaces);
    },
    [onDragEnd, displayedPlaces],
  );

  const handleQuickAddPlaceCreated = useCallback(
    (place: Record<string, unknown>) => {
      setPlaces((prev) => [...prev, place]);
      handleAddPlace(place);
    },
    [handleAddPlace],
  );

  const {
    isQuickAddModalOpen,
    setIsQuickAddModalOpen,
    newPlaceData,
    setNewPlaceData,
    quickAddSaving,
    quickAddError,
    openQuickAddModal,
    handleQuickAddPlace,
  } = useQuickAddPlace({
    defaultCity: filterCity || tripCities[0] || '',
    onPlaceCreated: handleQuickAddPlaceCreated,
    onClearSearch: () => setSearchQuery(''),
  });

  const handleSaveAsTemplate = useCallback(async () => {
    if (!supabase) return;

    const templateName = templateSaveTitle.trim();
    if (!templateName) {
      setNotice('يرجى إدخال اسم للقالب أولاً');
      return;
    }

    setTemplateBusy(true);
    setNotice(null);
    try {
      await saveItineraryTemplate(supabase, {
        templateName,
        destination: geographyDestinationLabel,
        daysData: itineraryDaysToDaysData(itineraryDays),
        hotelDetails: hotelsToDetailsPayload(hotels),
        flightDetails: buildTemplateFlightDetails({
          originCity,
          destination: flightArrivalCity,
          departureTime,
          arrivalTime,
          gate,
          seat,
          bookingRef: pnr,
        }),
        sourceItineraryId: id,
      });
      const { templates: refreshed } = await fetchItineraryTemplates(supabase);
      setTemplates(refreshed);
      setNotice('✅ تم حفظ القالب في itinerary_templates بنجاح!');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message?: unknown }).message ?? e)
            : String(e);
      setNotice(msg || 'Template save failed.');
    } finally {
      setTemplateBusy(false);
    }
  }, [templateSaveTitle, geographyDestinationLabel, flightArrivalCity, itineraryDays, hotels, id, originCity, departureTime, arrivalTime, gate, seat, pnr, supabase]);

  const handleLoadTemplate = useCallback(() => {
    if (!selectedTemplateId) {
      setNotice('اختر قالباً من القائمة أولاً.');
      return;
    }
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const applied = applyTemplateToBuilder(template, { currentDateFrom: tripDateFrom });
    setItineraryDays(applied.days);
    if (applied.destination) {
      const dest = applied.destination.trim();
      if (dest) setTripCities([dest]);
    }
    if (applied.hotels.length > 0) setHotels(applied.hotels);
    if (applied.datesFrom) setTripDateFrom(applied.datesFrom);
    if (applied.datesTo) setTripDateTo(applied.datesTo);
    setNotice(`✅ تم استدعاء القالب: ${template.title}`);
  }, [selectedTemplateId, templates, tripDateFrom]);

  const handleDocumentUpload = useCallback(
    async (file: File) => {
      if (!supabase || !id) return;
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setNotice('يرجى رفع ملف PDF فقط (تذكرة أو قسيمة).');
        return;
      }

      setDocUploading(true);
      setNotice(null);
      try {
        const { publicUrl } = await uploadItineraryPdf(supabase, file, id);

        const doc: ItineraryDocument = {
          id: `doc-${Date.now()}`,
          name: file.name,
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
          mimeType: 'application/pdf',
        };
        setDocuments((prev) => [...prev, doc]);
        setNotice('✅ تم رفع المستند — يظهر في المحفظة أدناه. احفظ المسار لتثبيته.');
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'تعذر رفع المستند.');
      } finally {
        setDocUploading(false);
      }
    },
    [id],
  );

  const handleRemoveDocument = useCallback((docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const handleShareWhatsApp = useCallback(() => {
    const currentClient = selectedClientId
      ? clientsList.find((c) => String(c.id) === String(selectedClientId))
      : null;

    const result = openItineraryWhatsAppShare({
      client: currentClient,
      itinerarySlug: itineraryShareSlug || id || '',
    });

    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice('تم فتح واتساب للعميل ✨');
  }, [clientsList, selectedClientId, itineraryShareSlug, id]);

  const handleSave = useCallback(async () => {
    if (!supabase || !id) return;

    setSaving(true);
    setNotice(null);

    const queryId = /^\d+$/.test(id) ? Number(id) : id;
    const serializedDays = itineraryDaysToDaysData(itineraryDays);

    const selectedClient = selectedClientId
      ? clientsList.find((c) => String(c.id) === String(selectedClientId))
      : null;

    const destinationSummary = buildDestinationSummary(tripCities, tripCountries) || tripTitle;

    const payload = buildStrictSimpleItinerarySavePayload({
      daysData: serializedDays,
      budget,
      paid,
      departureTime,
      arrivalTime,
      bookingRef: pnr,
      passcode: accessCode,
      title: tripTitle || destinationSummary,
      destination: destinationSummary,
      originCity,
      arrivalCity: normalizeSingleArrivalCity(flightArrivalCity),
      geoTripType,
      countries: tripCountries,
      cities: tripCities,
      datesFrom: tripDateFrom,
      datesTo: tripDateTo,
      gate,
      seat,
      hotels: hotels.map((h) => ({
        name: h.name,
        pnr: h.pnr,
        checkIn: h.checkIn,
        checkOut: h.checkOut,
      })),
      clientId:
        selectedClientId && Number.isFinite(Number(selectedClientId))
          ? Number(selectedClientId)
          : null,
      customerName: selectedClient ? clientDisplayName(selectedClient) : '',
      preTripServices,
      includeWardrobe: includeFashionServices,
      documents,
      supplierRequests,
      ticketDetails: activityTickets,
      showFashionServices: includeFashionServices,
      isMedical: itineraryHasMedicalPreTrip(preTripServices),
      status: tripStatus || 'active',
    });

    const expectedProfitNum = Number(expectedProfit) || 0;

    const fullPayload = {
      ...payload,
      expected_profit: expectedProfitNum,
    };

    try {
      const { error } = await supabase.from('itineraries').update(fullPayload).eq('id', queryId);

      if (error) {
        console.error('Supabase Save Error:', error);
        throw new Error(formatSupabaseSaveError(error));
      }
      setNotice('✅ تم حفظ المسار والتعديلات بنجاح!');
    } catch (e) {
      console.error('Unexpected save error:', e);
      setNotice(e instanceof Error ? e.message : 'فشل حفظ التعديلات.');
    } finally {
      setSaving(false);
    }
  }, [
    id,
    accessCode,
    tripTitle,
    geoTripType,
    tripCountries,
    tripCities,
    flightArrivalCity,
    tripDateFrom,
    tripDateTo,
    budget,
    paid,
    originCity,
    departureTime,
    arrivalTime,
    gate,
    seat,
    pnr,
    hotels,
    itineraryDays,
    selectedClientId,
    clientsList,
    preTripServices,
    includeFashionServices,
    expectedProfit,
    documents,
    supplierRequests,
    activityTickets,
    tripStatus,
  ]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#FAFAFA] flex items-center justify-center"
        dir="rtl"
      >
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
        <span className="sr-only">جاري التحميل...</span>
      </div>
    );
  }

  const selectedClientProfile = selectedClientId
    ? clientsList.find((c) => String(c.id) === String(selectedClientId))
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E2720] p-6 font-sans sm:p-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">مساحة بناء المسار الذكي</h1>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg bg-[#1A2520] px-8 py-3 font-bold text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
        </button>
      </div>

      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="min-w-0 md:col-span-2">
            <TripGeographySelectors
              geoTripType={geoTripType}
              onGeoTripTypeChange={setGeoTripType}
              countries={tripCountries}
              onCountriesChange={setTripCountries}
              cities={tripCities}
              onCitiesChange={setTripCities}
              tripTitle={tripTitle}
              onTripTitleChange={setTripTitle}
              customCitiesText={customCitiesText}
              onCustomCitiesTextChange={setCustomCitiesText}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">اسم العميل</label>
              <select
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={EDIT_HEADER_FIELD}
              >
                <option value="">-- اختر العميل --</option>
                {clientsList.map((client) => (
                  <option key={String(client.id)} value={String(client.id)}>
                    {clientDisplayName(client)}
                  </option>
                ))}
              </select>
              {selectedClientProfile ? (
                <div className="mt-2">
                  <VipSpendingTierBadge
                    tier={selectedClientProfile.vip_tier}
                    totalSpent={selectedClientProfile.total_spent}
                  />
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ البداية</label>
              <input
                type="date"
                value={tripDateFrom}
                onChange={(e) => setTripDateFrom(e.target.value)}
                className={`${EDIT_HEADER_FIELD} [color-scheme:light]`}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</label>
              <input
                type="date"
                value={tripDateTo}
                onChange={(e) => setTripDateTo(e.target.value)}
                className={`${EDIT_HEADER_FIELD} [color-scheme:light]`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#FEFDF9] px-5 py-3 shadow-sm">
        <span className="text-sm font-bold text-gray-700">كود العميل (PIN)</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-[#D4AF37]/60 bg-white px-4 py-1.5">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="---"
              dir="ltr"
              size={Math.max(accessCode.length || 3, 7)}
              className="min-w-[5ch] border-0 bg-transparent p-0 text-sm font-bold tracking-wider text-[#D4AF37] outline-none placeholder:text-[#D4AF37]/40"
            />
          </div>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={!selectedClientId}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#25D366]/40 bg-[#25D366] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            مشاركة عبر واتساب
          </button>
        </div>
      </div>

      {notice ? (
        <p
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${
            notice.includes('بنجاح')
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <section className="mb-6 flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-bold text-[#1E2720]">
          <FileStack className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          إدارة القوالب الجاهزة 📁
        </h3>

        {templatesNotice ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            {templatesNotice}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-sm font-bold text-gray-700">استدعاء قالب جاهز</p>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className={EDIT_HEADER_FIELD}
            >
              <option value="">— اختر قالباً —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.destination ? ` · ${t.destination}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLoadTemplate}
              disabled={!selectedTemplateId}
              className="rounded-lg border border-[#D4AF37]/40 bg-[#FEFDF9] px-4 py-2.5 text-sm font-bold text-[#1E2720] transition hover:bg-[#D4AF37]/10 disabled:opacity-50"
            >
              استدعاء القالب إلى المسار
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-sm font-bold text-gray-700">حفظ كقالب</p>
            <input
              type="text"
              value={templateSaveTitle}
              onChange={(e) => setTemplateSaveTitle(e.target.value)}
              placeholder="اسم القالب — مثال: باريس 5 أيام"
              className={EDIT_HEADER_FIELD}
            />
            <button
              type="button"
              onClick={() => void handleSaveAsTemplate()}
              disabled={templateBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A2520] px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:bg-black disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {templateBusy ? 'جاري الحفظ…' : 'حفظ كقالب'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D4AF37]/25 bg-[#FEFDF9] p-4">
            <div>
              <p className="text-sm font-bold text-gray-800">تفعيل خدمات الأزياء والكونسيرج</p>
              <p className="text-xs text-gray-500">
                عند الإيقاف يُخفى تبويب الصالون الذهبي / أزياء السفر من واجهة العميل
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeFashionServices}
              onClick={() => setIncludeFashionServices((v) => !v)}
              className={`relative h-9 w-[3.25rem] shrink-0 rounded-full transition-colors ${
                includeFashionServices ? 'bg-[#1A2520]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-[inset-inline-start] ${
                  includeFashionServices ? 'start-[calc(100%-1.875rem)]' : 'start-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
        <h3 className="font-bold text-lg text-[#1E2720] flex items-center gap-2">
          <span>💰</span> الملخص المالي للحجز
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">الميزانية الإجمالية</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="مثال: 50000"
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-3 font-bold focus:border-[#D4AF37]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">المدفوع من العميل</label>
            <input
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="مثال: 20000"
              className="bg-gray-50 border border-gray-300 text-green-700 rounded-lg p-3 font-bold focus:border-green-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">المتبقي</label>
            <div
              className={`p-3 rounded-lg font-bold text-lg border ${
                remaining > 0
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              {remaining.toLocaleString()} SAR
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">
              رسوم خدمة وإدارة (Wanderloom)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={expectedProfit}
              onChange={(e) => setExpectedProfit(e.target.value)}
              placeholder="0"
              className="bg-gray-50 border border-gray-300 text-[#1E2720] rounded-lg p-3 font-bold focus:border-[#D4AF37]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col gap-4">
        <h3 className="font-bold text-lg text-[#1E2720] flex items-center gap-2">
          <span>✈️</span> بيانات البوردينق والحجوزات الفندقية
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">من مدينة (رحلة الطيران)</span>
            <input
              type="text"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="مثال: الرياض"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-bold text-gray-600">
              إلى مدينة (رحلة الطيران — مدينة واحدة)
            </span>
            <input
              type="text"
              list="flight-arrival-city-suggestions"
              value={flightArrivalCity}
              onChange={(e) => setFlightArrivalCity(e.target.value)}
              onBlur={(e) =>
                setFlightArrivalCity(normalizeSingleArrivalCity(e.target.value))
              }
              placeholder={tripCities[0] ? `مثال: ${tripCities[0]}` : 'مثال: سيول'}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
            {tripCities.length > 0 ? (
              <datalist id="flight-arrival-city-suggestions">
                {tripCities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            ) : null}
            <span className="text-xs text-gray-500">
              مدينة هبوط الطيران فقط — لا تُربط تلقائياً بكل مدن المسار.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت المغادرة</span>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت الوصول</span>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">البوابة</span>
            <input
              type="text"
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              placeholder="A12"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">المقعد</span>
            <input
              type="text"
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder="5A"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
        </div>

        <label className="flex max-w-md flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-600">رقم تأكيد الطيران (PNR)</span>
          <input
            type="text"
            value={pnr}
            onChange={(e) => setPnr(e.target.value)}
            placeholder="ABC12X"
            className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
          />
        </label>

        <h4 className="text-sm font-bold text-[#1E2720]">🏨 الفنادق والإقامة</h4>
        <ItineraryHotelsEditor
          hotels={hotels}
          onChange={setHotels}
          supplierBrief={supplierBrief}
          filteredSuppliers={filteredSuppliers}
          destinationLabel={supplierDestinationLabel}
          tripCountries={tripCountries}
          tripCities={tripCities}
        />
      </section>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#1E2720]">
          <span>🎟️</span> تذاكر الفعاليات والدخول
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          مدن الألعاب، السيرك، المتاحف — تظهر للعميل في تبويب الحجوزات.
        </p>
        <ActivityTicketsEditor tickets={activityTickets} onChange={setActivityTickets} />
      </section>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#1E2720]">
          <FileText className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          محفظة المستندات (PDF)
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          ارفع تذاكر الطيران والقسائم الفندقية — تُحفظ روابط الملفات في المسار للفريق الداخلي.
        </p>

        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-[#FEFDF9] px-6 py-8 transition hover:border-[#D4AF37]/70 hover:bg-[#FFFBF0]">
          <Upload className="h-8 w-8 text-[#D4AF37]" aria-hidden />
          <span className="text-sm font-bold text-gray-800">
            {docUploading ? 'جاري الرفع…' : 'اضغط لرفع PDF'}
          </span>
          <span className="text-xs text-gray-500">تذكرة · قسيمة فندق · تأكيد حجز</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={docUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleDocumentUpload(file);
              e.target.value = '';
            }}
          />
        </label>

        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            لا توجد مستندات بعد.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{doc.name}</p>
                  {doc.uploadedAt ? (
                    <p className="text-xs text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#D4AF37]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#1E2720] hover:bg-[#FEFDF9]"
                  >
                    عرض PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#FFFBF0] to-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#1E2720]">
            <span>✨</span> خدمات الكونسيرج ما قبل السفر (VIP)
          </h3>
          <button
            type="button"
            onClick={() => setPreTripServices((prev) => [...prev, emptyPreTripService()])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#1E2720] px-3 py-2 text-xs font-bold text-[#D4AF37] transition hover:bg-[#2a362c]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            إضافة خدمة
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          مثل حجز صالون تجميل VIP قبل السفر — تظهر للعميل كقسائم فاخرة مع الموعد والموقع ورقم التواصل.
        </p>
        {preTripServices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            لا توجد خدمات ما قبل السفر بعد. اضغط «إضافة خدمة».
          </p>
        ) : (
          <div className="space-y-4">
            {preTripServices.map((service, index) => (
              <div
                key={`pre-trip-${index}`}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-[#D4AF37]">
                    خدمة #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreTripServices((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                    aria-label="حذف الخدمة"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className="text-xs font-bold text-gray-600">عنوان الخدمة *</span>
                    <input
                      type="text"
                      value={service.title}
                      onChange={(e) =>
                        setPreTripServices((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, title: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="مثال: حجز صالون تجميل VIP"
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">موعد الحجز</span>
                    <input
                      type="datetime-local"
                      value={service.datetime}
                      onChange={(e) =>
                        setPreTripServices((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, datetime: e.target.value } : item,
                          ),
                        )
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-gray-600">رقم التواصل</span>
                    <input
                      type="tel"
                      value={service.phone}
                      onChange={(e) =>
                        setPreTripServices((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, phone: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="+966 5X XXX XXXX"
                      dir="ltr"
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className="text-xs font-bold text-gray-600">رابط الموقع (Google Maps)</span>
                    <input
                      type="url"
                      value={service.location_url}
                      onChange={(e) =>
                        setPreTripServices((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, location_url: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="https://maps.google.com/..."
                      dir="ltr"
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className="text-xs font-bold text-gray-600">ملاحظة / تفاصيل</span>
                    <textarea
                      value={service.note}
                      onChange={(e) =>
                        setPreTripServices((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, note: e.target.value } : item,
                          ),
                        )
                      }
                      rows={2}
                      placeholder="مثال: شعر ومناكير — مدفوع بالكامل من Wanderloom"
                      className="resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#D4AF37]"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-6 h-[750px]">
        <aside className="w-[35%] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
            <h3 className="font-bold text-lg">
              بنك الأماكن ({displayedPlaces.length} مكان متاح)
            </h3>

            <input
              type="text"
              placeholder="ابحث بالاسم أو الحي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 p-3 rounded-lg w-full focus:border-[#D4AF37] outline-none"
            />

            <div className="flex gap-2">
              <select
                value={filterCity}
                onChange={(e) => {
                  setFilterCity(e.target.value);
                  setFilterCategory('');
                }}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل المدن</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل الفئات</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <SimpleItineraryPlacesBank
            places={displayedPlaces}
            activeDayLabel={activeDayLabel}
            searchQuery={searchQuery}
            onAddPlace={handleAddPlace}
            onQuickAddClick={() => openQuickAddModal(searchQuery)}
          />
        </aside>

        <SimpleItineraryDayPlanner
          days={itineraryDays}
          hotels={hotels}
          activeDayId={activeDayId}
          onActiveDayIdChange={setActiveDayId}
          onAddDay={handleAddDay}
          onRemovePlace={handleRemovePlace}
          onUpdateDayHotel={updateDayHotel}
          onUpdateDayCity={updateDayCity}
          onUpdateTransport={updateTransport}
          dayDroppableId={dayDroppableId}
          supplierBrief={supplierBrief}
        />
      </div>
      </DragDropContext>

      <section className="mb-6 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#FEFDF9] to-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold text-[#1E2720]">إدارة الموردين والطلبات الخاصة</h3>
        <p className="mb-4 text-sm text-gray-500">
          دورة العمل: بانتظار رد المورد ⏳ → تم التأكيد 🔴 → تم الدفع 🟢 — تظهر في الرادار الحي
          تلقائياً.
        </p>
        <SupplierRequestsEditor
          requests={supplierRequests}
          onChange={setSupplierRequests}
          filteredSuppliers={filteredSuppliers}
          allSuppliers={allSuppliers}
          destination={supplierDestinationLabel}
          briefContext={{
            clientName: (() => {
              if (!selectedClientId) return undefined;
              const match = clientsList.find((c) => String(c.id) === String(selectedClientId));
              return match ? clientDisplayName(match) : undefined;
            })(),
            destination: geographyDestinationLabel,
            tripDates:
              tripDateFrom && tripDateTo
                ? `${tripDateFrom} → ${tripDateTo}`
                : tripDateFrom || tripDateTo || undefined,
          }}
        />
      </section>

      <QuickAddPlaceModal
        open={isQuickAddModalOpen}
        draft={newPlaceData}
        saving={quickAddSaving}
        error={quickAddError}
        onClose={() => setIsQuickAddModalOpen(false)}
        onChange={(patch) => setNewPlaceData((prev) => ({ ...prev, ...patch }))}
        onSave={handleQuickAddPlace}
      />
    </div>
  );
}
