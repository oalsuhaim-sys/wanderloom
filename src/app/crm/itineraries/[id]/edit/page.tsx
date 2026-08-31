'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Loader2, MessageCircle, Plus, Trash2, Copy, CopyPlus, FileStack, Camera } from 'lucide-react';
import { DragDropContext } from '@hello-pangea/dnd';

import {
  fetchItineraryClientIdAction,
  saveItineraryClientLinkAction,
} from '@/app/actions/itineraryClientActions';
import { duplicateItineraryAction } from '@/app/actions/itineraryDuplicateActions';
import { toast } from '@/lib/crm-toast';
import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { canEditItineraries } from '@/lib/crm-permissions';
import SimpleItineraryDayPlanner from '@/app/crm/itineraries/_components/SimpleItineraryDayPlanner';
import SupplierRequestsEditor from '@/app/crm/itineraries/_components/SupplierRequestsEditor';
import SimpleItineraryPlacesBank from '@/app/crm/itineraries/_components/SimpleItineraryPlacesBank';
import ExperiencesExplorer from '@/app/crm/itineraries/_components/ExperiencesExplorer';
import ItineraryPlacesSourceTabs, {
  type ItineraryPlacesSource,
} from '@/app/crm/itineraries/_components/ItineraryPlacesSourceTabs';
import TripGeographySelectors from '@/app/crm/itineraries/_components/TripGeographySelectors';
import ItineraryHotelsEditor from '@/app/crm/itineraries/_components/ItineraryHotelsEditor';
import BoardingFlightFieldsPanel from '@/app/crm/itineraries/_components/BoardingFlightFieldsPanel';
import ActivityTicketsEditor from '@/app/crm/itineraries/_components/ActivityTicketsEditor';
import ItineraryDocumentWallet from '@/app/crm/itineraries/_components/ItineraryDocumentWallet';
import VipSpendingTierBadge from '@/components/VipSpendingTierBadge';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { QuickAddPlaceModal, useQuickAddPlace } from '@/app/crm/itineraries/_components/useQuickAddPlace';
import {
  createEmptyDay,
  createEmptyHotelEntry,
  parseHotelsFromDetailsRaw,
  hotelsToDetailsPayload,
  sortPlacesByVisitTime,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { useSimpleItineraryDays } from '@/app/crm/itineraries/_components/useSimpleItineraryDays';
import { buildStrictSimpleItinerarySavePayload, normalizeItinerarySaveStatus, readItineraryExpertDisplayName, readItineraryExpertId, resolveTripDatesFromRow, stripItineraryPayloadForSchemaError } from '@/lib/itinerary-builder-model';
import {
  WL_BTN_PRIMARY,
  WL_BTN_SECONDARY,
  WL_DATE_INPUT,
  WL_INPUT,
  WL_LABEL,
  WL_OPTION,
  WL_PAGE,
  WL_SECTION,
  WL_SELECT,
  WL_TITLE,
} from '@/lib/itinerary-builder-ui';
import {
  applyTemplateToBuilder,
  buildTemplateFlightDetails,
  fetchItineraryTemplates,
  saveItineraryTemplate,
  type ItineraryTemplateRow,
} from '@/lib/itinerary-templates';
import {
  parseItineraryDocuments,
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
  filterSuppliersByCountries,
  parseItineraryGeography,
  type GeoTripType,
} from '@/lib/itinerary-geography';
import {
  clientDisplayName,
  CRM_CLIENTS_LIST_SELECT,
  ITINERARY_CLIENT_JOIN_SELECT,
  coerceClientIdForItinerarySave,
  fetchCrmClientMiniById,
  mergeClientIntoList,
  copyItineraryPortalUrl,
  openItineraryWhatsAppShare,
  parseCrmClientIdForSave,
  parseJoinedCrmClient,
  resolveItineraryClientIdFromDb,
  resolveItineraryPublicSlug,
  type CrmClientMini,
} from '@/lib/itinerary-client-crm';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';
import {
  PLACE_CATEGORY_OPTIONS,
  PLACES_BANK_PAGE_SIZE,
  fetchPlacesBankCityOptions,
  fetchPlacesBankPage,
} from '@/lib/places-bank';

const CLIENT_BRIEF_SELECT =
  'id, name, travel_dna, hotel_preferences, dietary, secret_notes';
const CLIENT_BRIEF_SELECT_MIN = 'id, name';

type ExpertMini = {
  id: string;
  name: string;
  status?: string | null;
  specialty_regions?: string | null;
  dna_profile?: unknown;
};

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
        places: sortPlacesByVisitTime((row.places as any[]).map(withTransportDefaults)),
      };
    }

    const stops = (row.itinerary_stops ?? row.stops ?? []) as Array<Record<string, unknown>>;
    const places = sortPlacesByVisitTime(
      stops.map((s) =>
        withTransportDefaults({
          id: s.places_bank_id ?? s.id,
          name: String(s.place_name ?? s.name ?? 'محطة').trim(),
          category: s.category,
          city: row.city ?? s.city,
          rating: s.rating,
          transportToNext: transitModeToArabic(s.transit_mode ?? s.transport_type),
          transportDuration: String(s.transit_duration ?? '').trim(),
          visit_time: String(s.visit_time ?? s.time_slot ?? s.time ?? '').trim(),
        }),
      ),
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
      ...(p.visit_time?.trim()
        ? { visit_time: p.visit_time.trim(), time_slot: p.visit_time.trim() }
        : {}),
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
  const router = useRouter();
  const id = resolveRouteId(params?.id as string | string[] | undefined);
  const { profileAccess } = useCrmEmployee();
  const canEditItinerary = canEditItineraries(profileAccess);
  const readOnly = !canEditItinerary;

  const [places, setPlaces] = useState<Record<string, unknown>[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placesPage, setPlacesPage] = useState(0);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [clientsList, setClientsList] = useState<CrmClientMini[]>([]);
  const [expertsList, setExpertsList] = useState<ExpertMini[]>([]);
  const [expertsLoadError, setExpertsLoadError] = useState<string | null>(null);
  const [expertId, setExpertId] = useState('');
  const [expertName, setExpertName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientLinkSaving, setClientLinkSaving] = useState(false);
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
  const [placesSourceTab, setPlacesSourceTab] = useState<ItineraryPlacesSource>('bank');

  const [budget, setBudget] = useState('');
  const [paid, setPaid] = useState('');
  const remaining = (Number(budget) || 0) - (Number(paid) || 0);

  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [gate, setGate] = useState('');
  const [seat, setSeat] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [terminal, setTerminal] = useState('');
  const [flightClass, setFlightClass] = useState('');
  const [departureCountry, setDepartureCountry] = useState('');
  const [arrivalCountry, setArrivalCountry] = useState('');
  const [pnr, setPnr] = useState('');
  const [hotels, setHotels] = useState<ItineraryHotelEntry[]>([createEmptyHotelEntry()]);
  const [preTripServices, setPreTripServices] = useState<PreTripService[]>([]);

  const [templates, setTemplates] = useState<ItineraryTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateSaveTitle, setTemplateSaveTitle] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templatesNotice, setTemplatesNotice] = useState('');
  const [expectedProfit, setExpectedProfit] = useState('');
  const [documents, setDocuments] = useState<ItineraryDocument[]>([]);
  const [supplierRequests, setSupplierRequests] = useState<SupplierRequest[]>([]);
  const [activityTickets, setActivityTickets] = useState<ActivityTicket[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<CrmSupplier[]>([]);
  const [tripStatus, setTripStatus] = useState('active');
  const {
    itineraryDays,
    setItineraryDays,
    activeDayId,
    setActiveDayId,
    activeDayLabel,
    handleAddDay,
    moveDay,
    handleAddPlace,
    handleRemovePlace,
    updateTransport,
    updateVisitTime,
    updateDayHotel,
    updateDayCity,
    updateDayTitle,
    onDragEnd,
    dayDroppableId,
  } = useSimpleItineraryDays([createEmptyDay(0)]);

  const [isLoading, setIsLoading] = useState(true);
  const [tripLoaded, setTripLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientLinkWarning, setClientLinkWarning] = useState<string | null>(null);
  const [memoryUploading, setMemoryUploading] = useState(false);
  const daysStorageKeyRef = useRef<DaysStorageKey>('days_data');
  const pinnedClientRef = useRef<CrmClientMini | null>(null);
  const adminMemoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadInitialData() {
      if (!supabase) return;

      try {
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

        const expertAccessToken = await getClientAccessToken();
        const expertsResponse = await fetch('/api/crm/experts', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${expertAccessToken}`,
          },
        });
        const expertsPayload = (await expertsResponse.json()) as {
          ok?: boolean;
          rows?: ExpertMini[];
          error?: string;
        };
        const expertsData = Array.isArray(expertsPayload.rows)
          ? expertsPayload.rows
          : [];
        const expertsError =
          !expertsResponse.ok || !expertsPayload.ok
            ? expertsPayload.error || `status_${expertsResponse.status}`
            : null;

        if (expertsError) {
          console.error('Failed to load experts', expertsError);
          setExpertsLoadError(expertsError);
          setExpertsList([]);
        } else {
          setExpertsLoadError(null);
          setExpertsList(
            expertsData
              .filter((row) => row?.id && row?.name)
              .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
          );
        }
      } catch (error) {
        console.error('Data loading error:', error);
      }
    }
    void loadInitialData();
  }, []);

  useEffect(() => {
    setPlacesPage(0);
  }, [searchQuery, filterCity, filterCategory, tripCountries]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setPlacesLoading(true);
        try {
          const { rows, total } = await fetchPlacesBankPage(supabase, {
            page: placesPage,
            pageSize: PLACES_BANK_PAGE_SIZE,
            search: searchQuery.trim() || undefined,
            category: filterCategory || undefined,
            countries: tripCountries.length ? tripCountries : undefined,
            cityFilter: filterCity || undefined,
          });
          if (cancelled) return;
          setPlaces(rows as Record<string, unknown>[]);
          setPlacesTotal(total);
        } catch (error) {
          console.error('[edit] Failed to load places inventory', error);
          if (!cancelled) {
            setPlaces([]);
            setPlacesTotal(0);
          }
        } finally {
          if (!cancelled) setPlacesLoading(false);
        }
      })();
    }, searchQuery.trim() ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery, filterCity, filterCategory, tripCountries, placesPage]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const cities = await fetchPlacesBankCityOptions(
          supabase,
          tripCountries.length ? tripCountries : undefined,
        );
        if (!cancelled) {
          setCityOptions(
            [...new Set([...cities, ...tripCities].filter(Boolean))].sort((a, b) =>
              a.localeCompare(b, 'ar'),
            ),
          );
        }
      } catch {
        if (!cancelled) setCityOptions(tripCities);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripCountries, tripCities]);

  useEffect(() => {
    async function loadClientBrief() {
      if (!supabase || !clientId) {
        setSupplierBrief(null);
        return;
      }

      const selectedClient = clientsList.find((c) => String(c.id) === String(clientId));
      const fallbackName = String(selectedClient?.name ?? '').trim();

      let clientRow: Record<string, unknown> | null = null;
      let result = await supabase
        .from('clients')
        .select(CLIENT_BRIEF_SELECT)
        .eq('id', clientId)
        .maybeSingle();

      if (result.error && /column|schema cache|does not exist/i.test(result.error.message ?? '')) {
        result = await supabase
          .from('clients')
          .select(CLIENT_BRIEF_SELECT_MIN)
          .eq('id', clientId)
          .maybeSingle();
      }

      if (!result.error && result.data) {
        clientRow = result.data as Record<string, unknown>;
      }

      let interests: unknown = [];
      const prefsResult = await supabase
        .from('client_preferences')
        .select('interests')
        .eq('client_id', clientId)
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
  }, [clientId, tripDateFrom, tripDateTo, tripCities, tripCountries, tripTitle, clientsList]);

  useEffect(() => {
    async function fetchItinerary() {
      setLoadError(null);
      setTripLoaded(false);

      if (!id) {
        setLoadError('معرّف المسار غير صالح.');
        setIsLoading(false);
        return;
      }
      if (!supabase) {
        setLoadError('Supabase غير مهيأ — تحقق من الإعدادات وأعد تحميل الصفحة.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

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
            setLoadError(
              fallback.error?.message || error?.message || 'لم يتم العثور على المسار.',
            );
            return;
          }
          safeData = fallback.data as Record<string, unknown>;
        }

        const joinedClient = parseJoinedCrmClient(safeData?.client);
        let resolvedClientId = await resolveItineraryClientIdFromDb(
          supabase,
          safeData ?? {},
          queryId,
        );

        const adminClientLink = await fetchItineraryClientIdAction(queryId);
        if (adminClientLink.ok) {
          if (adminClientLink.client_id) {
            resolvedClientId = adminClientLink.client_id;
          }
          setClientLinkWarning(null);
        } else {
          console.error('[edit-itinerary] admin client_id fetch failed:', adminClientLink.error);
          setClientLinkWarning(adminClientLink.error);
          if (adminClientLink.columnMissing) {
            toast.error(adminClientLink.error);
          }
        }

        setItineraryShareSlug(resolveItineraryPublicSlug(safeData, id));
        setClientId(resolvedClientId);
        setExpertId(
          safeData.expert_id != null
            ? String(safeData.expert_id)
            : readItineraryExpertId(safeData as Record<string, unknown>),
        );
        setExpertName(
          String(safeData.expert_name ?? '').trim() ||
            readItineraryExpertDisplayName(safeData as Record<string, unknown>) ||
            '',
        );

        let clientForList = joinedClient;
        if (!clientForList && resolvedClientId) {
          clientForList = await fetchCrmClientMiniById(supabase, resolvedClientId);
        }
        if (clientForList) {
          pinnedClientRef.current = clientForList;
          setClientsList((prev) => mergeClientIntoList(prev, clientForList));
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
        const parsedTripDates = resolveTripDatesFromRow(safeData as Record<string, unknown>);
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
        setGate(strField(safeData, ['gate']) || strField(fd, ['gate']));
        setTerminal(strField(fd, ['terminal']));
        setFlightNumber(strField(fd, ['flight_number']));
        setFlightClass(strField(fd, ['flight_class', 'flightClass']));
        setDepartureCountry(strField(fd, ['departure_country', 'departureCountry']));
        setArrivalCountry(strField(fd, ['arrival_country', 'arrivalCountry']));
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
                id, place_name, category, visit_time, time_slot, note,
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

        setTripLoaded(true);
      } catch (err) {
        console.error('Critical fetch error:', err);
        setLoadError(
          err instanceof Error ? err.message : 'تعذر تحميل المسار — حاول مرة أخرى.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void fetchItinerary();
  }, [id, reloadNonce]);

  const uniqueCities = cityOptions;

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

  const displayedPlaces = places;

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
    if (readOnly) {
      setNotice('صلاحية القراءة فقط — لا يمكن حفظ قالب.');
      return;
    }
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
          flightNumber,
          terminal,
          flightClass,
          departureCountry,
          arrivalCountry,
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
  }, [templateSaveTitle, geographyDestinationLabel, flightArrivalCity, itineraryDays, hotels, id, originCity, departureTime, arrivalTime, gate, seat, pnr, flightNumber, terminal, flightClass, departureCountry, arrivalCountry, supabase]);

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

  const handleShareWhatsApp = useCallback(() => {
    const tripId = String(id ?? '').trim();
    const currentClient = clientId
      ? clientsList.find((c) => String(c.id) === String(clientId))
      : null;

    const result = openItineraryWhatsAppShare({
      client: currentClient,
      clientId,
      itinerarySlug: tripId || itineraryShareSlug || '',
      itineraryId: tripId,
    });

    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice('تم فتح واتساب للعميل ✨');
  }, [clientsList, clientId, itineraryShareSlug, id]);

  const handleCopyShareLink = useCallback(async () => {
    const tripId = String(id ?? '').trim();
    if (!tripId) {
      setNotice('معرّف المسار غير متوفر — احفظ المسار أولاً.');
      return;
    }

    const result = await copyItineraryPortalUrl({
      itinerarySlug: tripId,
      clientId: clientId || null,
      itineraryId: tripId,
    });

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setNotice(
      result.url.includes('trip_id=')
        ? 'تم نسخ رابط المسار مع trip_id ✨'
        : 'تم نسخ رابط المسار ✨',
    );
  }, [clientId, id]);

  const handleAdminMemoryUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      const resolvedClientId = parseCrmClientIdForSave(clientId);
      const resolvedItineraryId = parseCrmClientIdForSave(id);

      if (!resolvedClientId) {
        toast.error('يرجى ربط المسار بعميل أولاً وحفظه قبل رفع الصور.');
        return;
      }

      if (!supabase) {
        toast.error('تعذر الاتصال بقاعدة البيانات.');
        return;
      }

      setMemoryUploading(true);

      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${resolvedClientId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('memories')
          .upload(filePath, file, {
            contentType: file.type || 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from('memories').getPublicUrl(filePath);
        const publicUrl = publicData.publicUrl;

        const payload: Record<string, unknown> = {
          client_id: resolvedClientId,
          location_name: 'مرفوع من الإدارة',
          image_url: publicUrl,
        };

        if (resolvedItineraryId != null) {
          payload.itinerary_id = resolvedItineraryId;
        }

        const { error: dbError } = await supabase.from('client_memories').insert(payload);

        if (dbError) throw dbError;

        toast.success('تم رفع الصورة بنجاح وحفظها في ذكريات العميل! 📸');
        setNotice('تم رفع الذكرى من لوحة الإدارة بنجاح 📸');
      } catch (error) {
        console.error('[admin-memory-upload]', error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error != null
              ? JSON.stringify(error)
              : String(error);
        toast.error(`فشل الرفع: ${message}`);
      } finally {
        setMemoryUploading(false);
      }
    },
    [clientId, id],
  );

  const persistClientLink = useCallback(
    async (rawClientId: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!id) return { ok: false as const, error: 'معرّف المسار غير صالح.' };

      const queryId = /^\d+$/.test(id) ? Number(id) : id;

      const linkResult = await saveItineraryClientLinkAction(queryId, rawClientId || null);
      if (!linkResult.ok) {
        console.error('SUPABASE client_id SAVE ERROR:', linkResult.error);
        setClientLinkWarning(linkResult.error);
        if (!silent) {
          toast.error(
            linkResult.columnMissing
              ? linkResult.error
              : `فشل ربط العميل: ${linkResult.error}`,
          );
        }
        return linkResult;
      }

      setClientId(linkResult.client_id != null ? String(linkResult.client_id) : '');
      setClientLinkWarning(null);
      return linkResult;
    },
    [id],
  );

  const handleClientIdChange = useCallback(
    async (next: string) => {
      setClientId(next);
      if (!id) return;

      setClientLinkSaving(true);
      try {
        await persistClientLink(next);
      } finally {
        setClientLinkSaving(false);
      }
    },
    [id, persistClientLink],
  );

  const handleDuplicate = useCallback(async () => {
    if (!id) return;
    if (
      !window.confirm(
        `إنشاء نسخة جديدة من هذا المسار؟\nسيُنسخ العنوان والأيام والأماكن والإعدادات دون تعديل الأصل.`,
      )
    ) {
      return;
    }
    setDuplicating(true);
    setNotice('جاري استنساخ الرحلة بكل تفاصيلها...');
    try {
      const token = await getClientAccessToken();
      const result = await duplicateItineraryAction(id, token);
      if (!result.ok) {
        setNotice(result.error);
        toast.error(result.error);
        return;
      }
      setNotice(`✅ تم إنشاء النسخة: ${result.title}`);
      router.push(`/crm/itineraries/${result.newId}/edit`);
    } catch (err) {
      console.error(err);
      setNotice('تعذر استنساخ المسار.');
    } finally {
      setDuplicating(false);
    }
  }, [id, router]);

  const handleSave = useCallback(async () => {
    if (readOnly) {
      toast.error('صلاحية القراءة فقط — لا يمكن حفظ المسار.');
      return;
    }
    if (!supabase || !id) return;

    setSaving(true);
    setNotice(null);

    const queryId = /^\d+$/.test(id) ? Number(id) : id;
    const serializedDays = itineraryDaysToDaysData(itineraryDays);

    const parsedClientId = coerceClientIdForItinerarySave(clientId);
    const selectedClient = parsedClientId
      ? clientsList.find((c) => String(c.id) === String(parsedClientId))
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
      flightNumber,
      terminal,
      flightClass,
      departureCountry,
      arrivalCountry,
      hotels: hotels.map((h) => ({
        name: h.name,
        pnr: h.pnr,
        checkIn: h.checkIn,
        checkOut: h.checkOut,
      })),
      clientId: parsedClientId,
      expertId: expertId.trim() || null,
      expertName:
        expertName.trim() ||
        expertsList.find((e) => String(e.id) === String(expertId))?.name?.trim() ||
        null,
      customerName: selectedClient ? clientDisplayName(selectedClient) : '',
      preTripServices,
      includeWardrobe: false,
      documents,
      supplierRequests,
      ticketDetails: activityTickets,
      showFashionServices: false,
      isMedical: itineraryHasMedicalPreTrip(preTripServices),
      status: tripStatus || 'active',
    });

    const expectedProfitNum = Number(expectedProfit) || 0;

    const fullPayload = {
      ...payload,
      expected_profit: expectedProfitNum,
      client_id: parsedClientId,
      expert_id: expertId.trim() || null,
      expert_name:
        expertName.trim() ||
        expertsList.find((e) => String(e.id) === String(expertId))?.name?.trim() ||
        null,
    };

    try {
      const linkResult = await persistClientLink(clientId, { silent: false });
      if (!linkResult.ok) {
        throw new Error(linkResult.error);
      }

      console.log('[edit-itinerary] save payload expert:', {
        expert_id: fullPayload.expert_id,
        expert_name: fullPayload.expert_name,
        flight_expert: (fullPayload.flight_details as { expert_name?: string } | undefined)
          ?.expert_name,
        days_meta: (fullPayload.days_data as { meta?: unknown } | undefined)?.meta,
      });

      let res = await supabase
        .from('itineraries')
        .update(fullPayload)
        .eq('id', queryId)
        .select('id, client_id');
      let attemptPayload: Record<string, unknown> = fullPayload;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (
          !res.error ||
          !/column|schema cache|does not exist|foreign key|expert_id|expert_name/i.test(
            res.error.message ?? '',
          )
        ) {
          break;
        }
        attemptPayload = stripItineraryPayloadForSchemaError(
          res.error.message ?? '',
          attemptPayload,
        );
        attemptPayload.client_id = parsedClientId;
        res = await supabase
          .from('itineraries')
          .update(attemptPayload)
          .eq('id', queryId)
          .select('id, client_id');
      }

      if (res.error) {
        console.error('SUPABASE SAVE ERROR:', res.error);
        const msg = formatSupabaseSaveError(res.error);
        toast.error(`فشل الحفظ في قاعدة البيانات: ${msg}`);
        throw new Error(msg);
      }

      if (!res.data?.length) {
        const msg =
          'لم يُحدَّث أي صف في itineraries — تحقق من معرّف المسار أو صلاحيات Supabase RLS.';
        console.error('[edit-itinerary]', msg, { queryId });
        toast.error(`فشل الحفظ في قاعدة البيانات: ${msg}`);
        throw new Error(msg);
      }
      setClientId(
        res.data[0]?.client_id != null ? String(res.data[0].client_id) : clientId,
      );
      setClientLinkWarning(null);
      setNotice('✅ تم حفظ المسار والتعديلات بنجاح!');
      toast.success('تم حفظ المسار وربط العميل بنجاح!');
    } catch (e) {
      console.error('Unexpected save error:', e);
      const msg = e instanceof Error ? e.message : 'فشل حفظ التعديلات.';
      setNotice(msg);
      if (!msg.includes('فشل الحفظ في قاعدة البيانات') && !msg.includes('فشل ربط العميل')) {
        toast.error(`فشل الحفظ: ${msg}`);
      }
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
    flightNumber,
    terminal,
    flightClass,
    departureCountry,
    arrivalCountry,
    pnr,
    hotels,
    itineraryDays,
    clientId,
    expertId,
    expertName,
    expertsList,
    clientsList,
    preTripServices,
    expectedProfit,
    documents,
    supplierRequests,
    activityTickets,
    tripStatus,
    persistClientLink,
    readOnly,
  ]);

  const retryLoad = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  if (isLoading) {
    return (
      <div
        className="itinerary-builder-page flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f8fafc] text-slate-800"
        dir="rtl"
      >
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
        <p className="text-sm font-bold text-slate-600">جاري تحميل المسار...</p>
      </div>
    );
  }

  if (!id || loadError || !tripLoaded) {
    return (
      <div
        className="itinerary-builder-page flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6 text-center text-slate-800"
        dir="rtl"
      >
        <p className="max-w-md text-base font-bold text-slate-700">
          {loadError || 'لم يتم العثور على المسار.'}
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className={WL_BTN_PRIMARY}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const selectedClientProfile = clientId
    ? clientsList.find((c) => String(c?.id) === String(clientId))
    : null;

  return (
    <div className={`${WL_PAGE} font-sans`} dir="rtl">
      {readOnly ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          وضع القراءة فقط — يمكنك مشاهدة المسار دون تعديل أو حفظ.
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/crm/itineraries"
            className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-[#D4AF37]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            ← العودة إلى المسارات
          </Link>
          <h1 className="text-2xl font-extrabold tracking-wide text-[#D4AF37] sm:text-3xl">
            مساحة بناء المسار الذكي
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDuplicate()}
            disabled={duplicating || saving || !id}
            title="نسخ كإصدار جديد (V2)"
            className={`${WL_BTN_SECONDARY} border-[#D4AF37]/40 shadow-md`}
          >
            {duplicating ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" aria-hidden />
            ) : (
              <CopyPlus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            )}
            {duplicating ? 'جاري الاستنساخ...' : 'نسخ كإصدار جديد'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || duplicating || readOnly}
            className={WL_BTN_PRIMARY}
          >
            {saving ? 'جاري الحفظ...' : readOnly ? 'قراءة فقط' : 'حفظ المسار'}
          </button>
        </div>
      </div>

      <div className={`mb-8 ${WL_SECTION}`}>
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
              <label className="mb-2 block text-sm font-bold text-gray-700">ربط العميل بالمسار</label>
              <select
                name="client_id"
                value={clientId || ''}
                disabled={clientLinkSaving || saving}
                onChange={(e) => void handleClientIdChange(e.target.value)}
                className={EDIT_HEADER_FIELD}
              >
                <option value="">-- بدون ربط عميل --</option>
                {clientsList.map((client) => (
                  <option key={String(client?.id ?? '')} value={String(client?.id ?? '')}>
                    {clientDisplayName(client)}
                  </option>
                ))}
              </select>
              {selectedClientProfile ? (
                <div className="mt-2">
                  <VipSpendingTierBadge
                    tier={selectedClientProfile?.vip_tier}
                    totalSpent={selectedClientProfile?.total_spent}
                  />
                </div>
              ) : null}
              {clientId ? (
                <span className="mt-1 inline-flex rounded bg-black/20 px-2 py-0.5 font-mono text-[10px] text-slate-500" dir="ltr">
                  ID: {String(clientId).slice(0, 8)}…
                </span>
              ) : null}
              {clientLinkSaving ? (
                <p className="mt-1 text-[11px] font-bold text-[#D4AF37]">جاري ربط العميل…</p>
              ) : null}
              {clientLinkWarning ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
                  {clientLinkWarning}
                </p>
              ) : null}

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-bold text-[#D4AF37]">
                  <Camera className="h-4 w-4 shrink-0" aria-hidden />
                  رفع ذكرى من الإدارة
                </p>
                <span className="mt-1 block text-xs text-slate-600">
                  يُرفع مباشرة إلى ذكريات العميل المرتبط — بدون رابط العميل.
                </span>
                <button
                  type="button"
                  onClick={() => adminMemoryInputRef.current?.click()}
                  disabled={!clientId || memoryUploading || clientLinkSaving || saving}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {memoryUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      جاري الرفع…
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                      رفع صورة للعميل
                    </>
                  )}
                </button>
                <input
                  ref={adminMemoryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleAdminMemoryUpload(e)}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">
                خبير الوجهة (مصمم المسار)
              </label>
              <select
                name="expert_id"
                value={expertId || ''}
                disabled={saving}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setExpertId(nextId);
                  if (!nextId) {
                    setExpertName('');
                    return;
                  }
                  const matched = expertsList.find((x) => String(x.id) === String(nextId));
                  const fromOption =
                    e.target.selectedOptions?.[0]?.text?.split(' · ')[0]?.trim() || '';
                  setExpertName(matched?.name?.trim() || fromOption || '');
                }}
                className={EDIT_HEADER_FIELD}
              >
                <option value="">-- اختر الخبير الذي صمم المسار --</option>
                {expertsList.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.name}
                    {expert.specialty_regions ? ` · ${expert.specialty_regions}` : ''}
                  </option>
                ))}
              </select>
              <p
                className={`mt-1.5 text-[11px] font-bold ${
                  expertsLoadError ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {expertsLoadError
                  ? `تعذر تحميل الخبراء: ${expertsLoadError}`
                  : `تم تحميل ${expertsList.length} خبير من قاعدة البيانات`}
              </p>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ البداية</label>
              <input
                type="date"
                value={tripDateFrom}
                onChange={(e) => setTripDateFrom(e.target.value)}
                className={WL_DATE_INPUT}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</label>
              <input
                type="date"
                value={tripDateTo}
                onChange={(e) => setTripDateTo(e.target.value)}
                className={WL_DATE_INPUT}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#FEFDF9] px-5 py-3 shadow-sm">
        <div>
          <span className="block text-sm font-bold text-gray-700">رمز فتح المسار</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-gray-500">
            قابل للمشاركة مع الرابط — منفصل عن رمز الملف الشخصي الخاص في صفحة العميل.
          </span>
        </div>
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
            onClick={() => void handleCopyShareLink()}
            disabled={!id}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#D4AF37]/50 bg-white px-4 py-2 text-xs font-black text-[#1E2720] shadow-sm transition hover:bg-[#FFFBF0] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            نسخ الرابط
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={!clientId}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#25D366]/40 bg-[#25D366] px-4 py-2 text-xs font-black text-slate-900 shadow-sm transition hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:opacity-45"
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

      <section className={`mb-6 ${WL_SECTION}`}>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#D4AF37]">
          <FileStack className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          إدارة القوالب الجاهزة 📁
        </h3>

        {templatesNotice ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200">
            {templatesNotice}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800 shadow-sm">
            <p className="mb-3 block text-base font-bold text-[#D4AF37]">استدعاء قالب جاهز</p>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className={WL_INPUT}
            >
              <option value="">— اختر قالباً —</option>
              {templates.map((t) => (
                <option key={t?.id ?? ''} value={t?.id ?? ''}>
                  {t?.title ?? 'قالب'}
                  {t?.destination ? ` · ${t.destination}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLoadTemplate}
              disabled={!selectedTemplateId}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-3 font-extrabold text-black shadow-md transition-all hover:bg-[#b8952d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              استدعاء القالب إلى المسار
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800 shadow-sm">
            <p className="mb-3 block text-base font-bold text-[#D4AF37]">حفظ كقالب</p>
            <input
              type="text"
              value={templateSaveTitle}
              onChange={(e) => setTemplateSaveTitle(e.target.value)}
              placeholder="اسم القالب — مثال: باريس 5 أيام"
              className={WL_INPUT}
            />
            <button
              type="button"
              onClick={() => void handleSaveAsTemplate()}
              disabled={templateBusy || readOnly}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-slate-100 px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition-all hover:bg-slate-200 disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {templateBusy ? 'جاري الحفظ…' : readOnly ? 'قراءة فقط' : 'حفظ كقالب'}
            </button>
          </div>
        </div>
      </section>

      <section className={`mb-6 flex flex-col gap-4 ${WL_SECTION}`}>
        <h3 className={WL_TITLE}>
          <span aria-hidden>💰</span> الملخص المالي للحجز
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className={WL_LABEL}>الميزانية الإجمالية</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="مثال: 50000"
              className={`${WL_INPUT} font-bold`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className={WL_LABEL}>المدفوع من العميل</label>
            <input
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="مثال: 20000"
              className={`${WL_INPUT} font-bold text-emerald-300`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div
              className={`rounded-lg border p-3 text-right ${
                remaining > 0
                  ? 'border-red-500/40 bg-slate-50'
                  : 'border-emerald-500/40 bg-slate-50'
              }`}
            >
              <span className="mb-1 block text-xs font-semibold text-slate-500">المتبقي</span>
              <span
                className={`text-lg font-extrabold ${
                  remaining > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                SAR {remaining.toLocaleString('ar-SA')}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className={WL_LABEL}>رسوم خدمة وإدارة (Wanderloom)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={expectedProfit}
              onChange={(e) => setExpectedProfit(e.target.value)}
              placeholder="0"
              className={`${WL_INPUT} font-bold`}
            />
          </div>
        </div>
      </section>

      <section className="mb-6 flex flex-col gap-5">
        <BoardingFlightFieldsPanel
          value={{
            originCity,
            departureCountry,
            flightArrivalCity,
            arrivalCountry,
            flightNumber,
            pnr,
            flightClass,
            departureTime,
            arrivalTime,
            terminal,
            gate,
            seat,
          }}
          onChange={(patch) => {
            if (patch.originCity !== undefined) setOriginCity(patch.originCity);
            if (patch.departureCountry !== undefined) setDepartureCountry(patch.departureCountry);
            if (patch.flightArrivalCity !== undefined) setFlightArrivalCity(patch.flightArrivalCity);
            if (patch.arrivalCountry !== undefined) setArrivalCountry(patch.arrivalCountry);
            if (patch.flightNumber !== undefined) setFlightNumber(patch.flightNumber);
            if (patch.pnr !== undefined) setPnr(patch.pnr);
            if (patch.flightClass !== undefined) setFlightClass(patch.flightClass);
            if (patch.departureTime !== undefined) setDepartureTime(patch.departureTime);
            if (patch.arrivalTime !== undefined) setArrivalTime(patch.arrivalTime);
            if (patch.terminal !== undefined) setTerminal(patch.terminal);
            if (patch.gate !== undefined) setGate(patch.gate);
            if (patch.seat !== undefined) setSeat(patch.seat);
          }}
          tripCities={tripCities ?? []}
          datalistId="flight-arrival-city-suggestions"
        />

        <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h4 className="mb-4 flex items-center gap-2 text-base font-bold text-[#D4AF37]">
            🏨 الفنادق والإقامة
          </h4>
          <ItineraryHotelsEditor
            hotels={hotels}
            onChange={setHotels}
            supplierBrief={supplierBrief}
            filteredSuppliers={filteredSuppliers}
            destinationLabel={supplierDestinationLabel}
            tripCountries={tripCountries}
            tripCities={tripCities}
          />
        </div>
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

      <ItineraryDocumentWallet
        documents={documents ?? []}
        onChange={setDocuments}
        onNotice={setNotice}
        description="ارفع تذاكر الطيران والقسائم الفندقية — تُحفظ روابط الملفات في المسار للفريق الداخلي."
      />

      <section className="mb-6 rounded-xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#FFFBF0] to-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#1E2720]">
            <span>✨</span> خدمات الكونسيرج ما قبل السفر (VIP)
          </h3>
          <button
            type="button"
            onClick={() => setPreTripServices((prev) => [...prev, emptyPreTripService()])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-slate-100 px-3 py-2 text-xs font-bold text-[#D4AF37] transition hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" aria-hidden />
            إضافة خدمة
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          مثل حجز صالون تجميل VIP قبل السفر — تظهر للعميل كقسائم فاخرة مع الموعد والموقع ورقم التواصل.
        </p>
        {(preTripServices ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            لا توجد خدمات ما قبل السفر بعد. اضغط «إضافة خدمة».
          </p>
        ) : (
          <div className="space-y-4">
            {(preTripServices ?? []).map((service, index) => (
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
                      value={service?.title ?? ''}
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
                      value={service?.datetime ?? ''}
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
                      value={service?.phone ?? ''}
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
                      value={service?.location_url ?? ''}
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
                      value={service?.note ?? ''}
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
      <div className="flex h-auto flex-col gap-4 lg:h-[750px] lg:flex-row lg:gap-6">
        <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:w-[35%]">
          <div className="flex flex-col gap-4 border-b border-gray-100 bg-gray-50 p-4 sm:p-5">
            <ItineraryPlacesSourceTabs
              value={placesSourceTab}
              onChange={setPlacesSourceTab}
              placesCount={placesTotal}
            />

            {placesSourceTab === 'bank' ? (
              <>
            <h3 className="font-bold text-lg">
              بنك الأماكن
              {placesLoading ? ' · جاري التحميل…' : ''}
            </h3>

            <input
              type="text"
              placeholder="ابحث بالاسم أو الحي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-bold text-slate-900 placeholder:text-slate-500 focus:border-[#D4AF37] focus:bg-white outline-none"
            />

            <div className="flex gap-2">
              <select
                value={filterCity}
                onChange={(e) => {
                  setFilterCity(e.target.value);
                  setFilterCategory('');
                }}
                className={`flex-1 ${WL_SELECT}`}
              >
                <option value="" className={WL_OPTION}>
                  كل المدن
                </option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c} className={WL_OPTION}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`flex-1 ${WL_SELECT}`}
              >
                <option value="" className={WL_OPTION}>
                  كل الفئات
                </option>
                {PLACE_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id} className={WL_OPTION}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {placesTotal > PLACES_BANK_PAGE_SIZE ? (
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-gray-600">
                <button
                  type="button"
                  disabled={placesPage <= 0 || placesLoading}
                  onClick={() => setPlacesPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40"
                >
                  السابق
                </button>
                <span>
                  {placesPage + 1} / {Math.max(1, Math.ceil(placesTotal / PLACES_BANK_PAGE_SIZE))}
                </span>
                <button
                  type="button"
                  disabled={
                    placesLoading ||
                    placesPage >= Math.ceil(placesTotal / PLACES_BANK_PAGE_SIZE) - 1
                  }
                  onClick={() => setPlacesPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            ) : null}
              </>
            ) : null}
          </div>

          {placesSourceTab === 'bank' ? (
          <SimpleItineraryPlacesBank
            places={displayedPlaces}
            activeDayLabel={activeDayLabel}
            searchQuery={searchQuery}
            onAddPlace={handleAddPlace}
            onQuickAddClick={() => openQuickAddModal(searchQuery)}
          />
          ) : (
            <ExperiencesExplorer
              activeDayLabel={activeDayLabel}
              defaultDestination={
                filterCity || supplierBrief?.destination || tripCities[0] || ''
              }
              onAddPlace={handleAddPlace}
            />
          )}
        </aside>

        <SimpleItineraryDayPlanner
          days={itineraryDays}
          hotels={hotels}
          activeDayId={activeDayId}
          onActiveDayIdChange={setActiveDayId}
          onAddDay={handleAddDay}
          onMoveDay={moveDay}
          onRemovePlace={handleRemovePlace}
          onUpdateDayHotel={updateDayHotel}
          onUpdateDayCity={updateDayCity}
          onUpdateDayTitle={updateDayTitle}
          onUpdateTransport={updateTransport}
          onUpdateVisitTime={updateVisitTime}
          dayDroppableId={dayDroppableId}
          supplierBrief={supplierBrief}
          predictiveWishContext={
            supplierBrief
              ? {
                  clientRow: {
                    travel_dna: supplierBrief?.dna,
                    favorite_drink: supplierBrief?.dna?.drink_coffee ?? '',
                    dna_interests: (supplierBrief?.interests ?? []).join('، '),
                    dietary: supplierBrief?.dietary ?? '',
                  },
                  interests: supplierBrief?.interests ?? [],
                  destination: supplierBrief?.destination ?? '',
                  tripDateFrom: supplierBrief?.tripDateFrom ?? '',
                  tripDateTo: supplierBrief?.tripDateTo ?? '',
                }
              : null
          }
          onApplyPredictiveWish={(place) => handleAddPlace(place, activeDayId)}
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
              if (!clientId) return undefined;
              const match = clientsList.find((c) => String(c?.id) === String(clientId));
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
