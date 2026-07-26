'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DragDropContext } from '@hello-pangea/dnd';
import { ArrowRight, Copy, FileStack, Loader2, Plus, Trash2 } from 'lucide-react';

import { getQuoteLedgerAction } from '@/app/actions/invoiceActions';
import { saveItineraryClientLinkAction } from '@/app/actions/itineraryClientActions';
import SimpleItineraryDayPlanner from '@/app/crm/itineraries/_components/SimpleItineraryDayPlanner';
import SimpleItineraryPlacesBank from '@/app/crm/itineraries/_components/SimpleItineraryPlacesBank';
import TripGeographySelectors from '@/app/crm/itineraries/_components/TripGeographySelectors';
import ItineraryHotelsEditor from '@/app/crm/itineraries/_components/ItineraryHotelsEditor';
import { VipTimeSlotSelect } from '@/app/crm/itineraries/_components/VipBookingFields';
import ActivityTicketsEditor from '@/app/crm/itineraries/_components/ActivityTicketsEditor';
import ItineraryDocumentWallet from '@/app/crm/itineraries/_components/ItineraryDocumentWallet';
import SupplierRequestsEditor from '@/app/crm/itineraries/_components/SupplierRequestsEditor';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { QuickAddPlaceModal, useQuickAddPlace } from '@/app/crm/itineraries/_components/useQuickAddPlace';
import {
  createEmptyDay,
  createEmptyHotelEntry,
  hotelsToDetailsPayload,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { useSimpleItineraryDays } from '@/app/crm/itineraries/_components/useSimpleItineraryDays';
import {
  buildSupplierBriefClientContext,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';
import {
  buildStrictSimpleItineraryInsertPayload,
  FLIGHT_CLASS_OPTIONS,
  stripItineraryPayloadForSchemaError,
} from '@/lib/itinerary-builder-model';
import {
  buildDestinationSummary,
  filterSuppliersByCountries,
  type GeoTripType,
} from '@/lib/itinerary-geography';
import {
  geographyFromDestinationLabels,
  parseItineraryBuilderPrefill,
} from '@/lib/itinerary-builder-prefill';
import {
  applyTemplateToBuilder,
  buildTemplateFlightDetails,
  fetchItineraryTemplates,
  saveItineraryTemplate,
  type ItineraryTemplateRow,
} from '@/lib/itinerary-templates';
import { type ItineraryDocument } from '@/lib/itinerary-documents';
import { parseGroupTripStoredDates } from '@/lib/group-trip-dates';
import { emptyPreTripService, itineraryHasMedicalPreTrip, type PreTripService } from '@/lib/public-itinerary';
import { type ActivityTicket } from '@/lib/itinerary-tickets';
import { type SupplierRequest } from '@/lib/supplier-requests';
import { fetchCrmSuppliers, type CrmSupplier } from '@/lib/crm-suppliers';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { fetchAllPlacesBank, filterPlacesBankInventory } from '@/lib/places-bank';
import type { PlaceBankRow } from '@/types/place';
import { coerceClientIdForItinerarySave } from '@/lib/itinerary-client-crm';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';

const ACTIVE_TRIP_KIND =
  'border-[#D4AF37]/50 bg-[#0B1511] text-[#D4AF37] ring-2 ring-[#D4AF37]/35';
const IDLE_TRIP_KIND =
  'border-gray-200 bg-white text-gray-800 hover:border-[#D4AF37]/40';
const LOCKED_FIELD =
  'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-700';
const BUILDER_FIELD =
  'w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:border-[#D4AF37]';

type ExpertMini = {
  id: string;
  name: string;
  status?: string | null;
  specialty_regions?: string | null;
  dna_profile?: unknown;
};

function extractGroupDestinationCities(titleAr: string, titleEn: string): string[] {
  const cities: string[] = [];
  const enMatch = titleEn.match(/\bto\s+(.+?)$/i)?.[1]?.trim();
  if (enMatch) cities.push(enMatch);
  const arMatch = titleAr.match(/(?:ل|إلى|في)\s*([\u0600-\u06FF]+)/)?.[1]?.trim();
  if (arMatch) cities.push(arMatch);
  return [...new Set(cities.filter(Boolean))];
}

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

function arabicTransportToMode(value: string): string {
  if (value === 'مشي') return 'walking';
  if (value === 'مترو') return 'metro';
  return 'car';
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
      places,
      itinerary_stops,
      stops: itinerary_stops,
    };
  });
}

/** نوع المسار عند الإنشاء — يُحفظ في itineraries.trip_type */
export type BuilderTripKind = 'private' | 'group';

type QuoteOption = {
  id: string;
  title: string;
  client_id: string | null;
  client_name: string;
  status: string;
};

type ReadyGroupOption = {
  id: string;
  title_ar: string;
  title_en: string;
  dates_ar: string | null;
  dates_en: string | null;
  is_active: boolean;
};

export default function ItineraryBuilderWorkspace() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          جاري تحميل مساحة البناء…
        </div>
      }
    >
      <ItineraryBuilderPageContent />
    </Suspense>
  );
}

function ItineraryBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPrefill = useMemo(
    () => parseItineraryBuilderPrefill(searchParams),
    [searchParams],
  );
  const urlPrefillApplied = useRef(false);
  // --- 1. States (الحالات) ---
  const [places, setPlaces] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [expertsList, setExpertsList] = useState<ExpertMini[]>([]);
  const [expertsLoadError, setExpertsLoadError] = useState<string | null>(null);
  const [expertId, setExpertId] = useState('');
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [readyGroups, setReadyGroups] = useState<ReadyGroupOption[]>([]);
  /** null حتى يختار الأدمن — إلزامي قبل الحفظ */
  const [tripKind, setTripKind] = useState<BuilderTripKind | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupTourName, setGroupTourName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [activeClient, setActiveClient] = useState<any | null>(null);
  const [clientInterests, setClientInterests] = useState<string[]>([]);
  const [accessCode, setAccessCode] = useState('');

  // البحث والفلاتر
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

  // المالية
  const [budget, setBudget] = useState('');
  const [paid, setPaid] = useState('');
  const [quoteFieldsLocked, setQuoteFieldsLocked] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const remaining = (Number(budget) || 0) - (Number(paid) || 0);
  const isPrivate = tripKind === 'private';
  const isGroup = tripKind === 'group';
  // البوردينق والفندق
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

  const [templates, setTemplates] = useState<ItineraryTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateSaveTitle, setTemplateSaveTitle] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templatesNotice, setTemplatesNotice] = useState('');
  const [documents, setDocuments] = useState<ItineraryDocument[]>([]);
  const [activityTickets, setActivityTickets] = useState<ActivityTicket[]>([]);
  const [preTripServices, setPreTripServices] = useState<PreTripService[]>([]);
  const [supplierRequests, setSupplierRequests] = useState<SupplierRequest[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<CrmSupplier[]>([]);

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

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // --- 2. جلب البيانات (تخطي أخطاء التايب سكريبت) ---
  useEffect(() => {
    async function loadInitialData() {
      if (!supabase) return;

      try {
        const [{ data: clientsData }, quotesRes, groupsRes] = await Promise.all([
          supabase.from('clients').select('id, name, phone_wa').order('name', { ascending: true }),
          supabase
            .from('quotations')
            .select('id, title, client_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('group_trips')
            .select('id, title_ar, title_en, dates_ar, dates_en, is_active, sort_order')
            .order('sort_order', { ascending: true }),
        ]);
        if (clientsData) setClients(clientsData as any[]);

        try {
          const { templates: loaded, usedFallback } = await fetchItineraryTemplates(supabase);
          setTemplates(loaded);
          if (usedFallback) {
            setTemplatesNotice(
              'القوالب تُحمّل من itineraries (is_template) — نفّذ itinerary_templates.sql للجدول المخصص.',
            );
          }
        } catch (templateErr) {
          console.warn('[builder] templates:', templateErr);
        }

        try {
          const supplierRows = await fetchCrmSuppliers(supabase);
          setAllSuppliers(supplierRows);
        } catch (supplierErr) {
          console.warn('[builder] suppliers:', supplierErr);
        }

        const clientsById = new Map<string, string>();
        for (const c of clientsData ?? []) {
          const row = c as { id?: unknown; name?: unknown };
          clientsById.set(String(row.id), String(row.name ?? '').trim() || `عميل #${row.id}`);
        }

        if (!quotesRes.error && quotesRes.data) {
          setQuotes(
            (quotesRes.data as Record<string, unknown>[]).map((q) => {
              const clientId = q.client_id != null ? String(q.client_id) : null;
              return {
                id: String(q.id ?? ''),
                title: String(q.title ?? '').trim() || 'عرض سعر',
                client_id: clientId,
                client_name: clientId
                  ? clientsById.get(clientId) || `عميل #${clientId}`
                  : 'بدون عميل',
                status: String(q.status ?? ''),
              };
            }).filter((q) => q.id),
          );
        }

        if (!groupsRes.error && groupsRes.data) {
          setReadyGroups(
            (groupsRes.data as Record<string, unknown>[])
              .map((g) => ({
                id: String(g.id ?? ''),
                title_ar: String(g.title_ar ?? '').trim(),
                title_en: String(g.title_en ?? '').trim(),
                dates_ar: g.dates_ar != null ? String(g.dates_ar) : null,
                dates_en: g.dates_en != null ? String(g.dates_en) : null,
                is_active: g.is_active !== false,
              }))
              .filter((g) => g.id && g.is_active),
          );
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
        console.log('FETCHED EXPERTS:', expertsData);
        console.log('FETCH ERROR:', expertsError);

        if (expertsError) {
          console.warn('[builder] experts:', expertsError);
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

  function applyDestinationsToGeography(destLabels: string[]) {
    const geo = geographyFromDestinationLabels(destLabels);
    setGeoTripType(geo.geoTripType);
    setTripCountries(geo.countries);
    setTripCities(geo.cities);
    if (geo.cities.length) {
      setCustomCitiesText(geo.cities.join('، '));
    }
  }

  useEffect(() => {
    if (urlPrefillApplied.current || !urlPrefill.hasAny) return;
    urlPrefillApplied.current = true;

    if (urlPrefill.quoteId || urlPrefill.clientId) {
      setTripKind('private');
    }
    if (urlPrefill.tripTitle) setTripTitle(urlPrefill.tripTitle);
    if (urlPrefill.startDate) setTripDateFrom(urlPrefill.startDate);
    if (urlPrefill.endDate) setTripDateTo(urlPrefill.endDate);
    if (urlPrefill.destinations.length) {
      applyDestinationsToGeography(urlPrefill.destinations);
    }
    if (urlPrefill.clientId) setSelectedClientId(urlPrefill.clientId);
    if (urlPrefill.quoteId) setSelectedQuoteId(urlPrefill.quoteId);
  }, [urlPrefill]);

  useEffect(() => {
    if (!urlPrefill.hasAny || urlPrefill.quoteId || !urlPrefill.clientId || !quotes.length) {
      return;
    }
    const match = quotes.find((q) => q.client_id === urlPrefill.clientId);
    if (match && !selectedQuoteId) {
      setSelectedQuoteId(match.id);
    }
  }, [quotes, selectedQuoteId, urlPrefill]);

  function clearQuoteSyncedFields() {
    setSelectedQuoteId('');
    setSelectedClientId('');
    setActiveClient(null);
    setQuoteFieldsLocked(false);
    setBudget('');
    setPaid('');
  }

  function handleTripKindChange(kind: BuilderTripKind) {
    setTripKind(kind);
    if (kind === 'group') {
      clearQuoteSyncedFields();
    } else {
      setSelectedGroupId('');
      setGroupTourName('');
    }
  }

  function handleQuoteSelect(quoteId: string) {
    setSelectedQuoteId(quoteId);
    if (!quoteId) {
      clearQuoteSyncedFields();
    }
  }

  function handleReadyGroupSelect(groupId: string) {
    setSelectedGroupId(groupId);
    const group = readyGroups.find((g) => g.id === groupId);
    if (!group) {
      setGroupTourName('');
      return;
    }
    const title = group.title_ar || group.title_en || 'رحلة جماعية';
    setGroupTourName(title);
    setTripTitle(title);

    const cities = extractGroupDestinationCities(group.title_ar, group.title_en);
    if (cities.length) {
      setTripCities(cities);
      setCustomCitiesText(cities.join('، '));
      if (cities.length === 1) {
        setGeoTripType('single');
      } else if (cities.length > 1) {
        setGeoTripType('multi');
      }
    }

    const parsedDates = parseGroupTripStoredDates(group.dates_ar, group.dates_en);
    if (parsedDates.from) setTripDateFrom(parsedDates.from);
    if (parsedDates.to) setTripDateTo(parsedDates.to);
  }

  /** عند اختيار عرض سعر — مزامنة فورية للحقول المالية والتواريخ والعنوان */
  useEffect(() => {
    if (tripKind !== 'private' || !selectedQuoteId || !supabase) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setQuoteLoading(true);
      setSaveNotice(null);

      try {
        const dbId = coerceQuotationIdForDb(selectedQuoteId);
        let { data, error } = await supabase
          .from('quotations')
          .select('*')
          .eq('id', dbId)
          .maybeSingle();

        if ((error || !data) && String(dbId) !== selectedQuoteId) {
          const retry = await supabase
            .from('quotations')
            .select('*')
            .eq('id', selectedQuoteId)
            .maybeSingle();
          data = retry.data;
          error = retry.error;
        }

        if (cancelled) return;

        if (error || !data) {
          setQuoteFieldsLocked(false);
          setSaveNotice('تعذر تحميل بيانات عرض السعر المحدد.');
          return;
        }

        const row = mapQuotationRow(data as Record<string, unknown>);
        const total = quotationTotalPrice(row);
        const ledgerRes = await getQuoteLedgerAction(selectedQuoteId);
        const paidAmount = ledgerRes.ok ? ledgerRes.ledger.paidAmount : 0;

        if (cancelled) return;

        setTripTitle(row.title || '');
        setTripDateFrom(row.start_date ?? '');
        setTripDateTo(row.end_date ?? '');
        setBudget(total > 0 ? String(total) : '0');
        setPaid(String(paidAmount));
        if (row.destinations.length) {
          applyDestinationsToGeography(row.destinations);
        }

        const clientId = row.client_id;
        if (clientId) {
          setSelectedClientId(clientId);
          const found = clients.find((c) => String(c.id) === clientId);
          setActiveClient(found || null);
        } else {
          const option = quotes.find((q) => q.id === selectedQuoteId);
          if (option?.client_id) {
            setSelectedClientId(option.client_id);
            const found = clients.find((c) => String(c.id) === option.client_id);
            setActiveClient(found || null);
          }
        }

        setQuoteFieldsLocked(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[builder] quote sync:', err);
          setSaveNotice('تعذر مزامنة بيانات عرض السعر.');
          setQuoteFieldsLocked(false);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQuoteId, tripKind, clients, quotes]);

  useEffect(() => {
    async function loadPlacesInventory() {
      if (!supabase) return;
      try {
        const loaded = await fetchAllPlacesBank(supabase);
        setPlaces(loaded as Record<string, unknown>[]);
      } catch (error) {
        console.error('Failed to load places inventory', error);
        setPlaces([]);
      }
    }
    void loadPlacesInventory();
  }, []);

  // --- 3. استخراج المدن والفئات للقوائم ---
  const uniqueCities = useMemo(() => {
    const pool = filterPlacesBankInventory((places ?? []) as PlaceBankRow[], {
      countries: tripCountries,
    });
    return Array.from(new Set(pool.map((p) => p?.city).filter(Boolean)));
  }, [places, tripCountries]);
  const uniqueCategories = Array.from(new Set(places.map((p) => p.category).filter(Boolean)));

  const displayedPlaces = useMemo(() => {
    return filterPlacesBankInventory((places ?? []) as PlaceBankRow[], {
      countries: tripCountries,
      cityFilter: filterCity || undefined,
      search: searchQuery,
      category: filterCategory || undefined,
    });
  }, [places, tripCountries, filterCity, searchQuery, filterCategory]);
  useEffect(() => {
    if (selectedClientId) {
      const found = clients.find(c => c.id == selectedClientId);
      setActiveClient(found || null);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    async function loadClientInterests() {
      if (!supabase || !selectedClientId) {
        setClientInterests([]);
      return;
    }
      const { data } = await supabase
        .from('client_preferences')
        .select('interests')
        .eq('client_id', selectedClientId)
        .maybeSingle();
      setClientInterests(
        Array.isArray((data as { interests?: unknown } | null)?.interests)
          ? ((data as { interests: unknown[] }).interests.map((x) => String(x).trim()).filter(Boolean))
          : [],
      );
    }
    void loadClientInterests();
  }, [selectedClientId]);

  const supplierBrief = useMemo((): SupplierBriefClientContext | null => {
    if (!selectedClientId) return null;
    return buildSupplierBriefClientContext({
      clientRow: activeClient,
      interests: clientInterests,
      tripDateFrom,
      tripDateTo,
      destination: buildDestinationSummary(tripCities, tripCountries) || tripTitle,
    });
  }, [activeClient, clientInterests, tripCities, tripCountries, tripTitle, selectedClientId, tripDateFrom, tripDateTo]);

  const predictiveWishContext = useMemo(() => {
    if (!selectedClientId && !tripTitle && !tripCities.length) return null;
    return {
      clientRow: activeClient,
      interests: clientInterests,
      destination: buildDestinationSummary(tripCities, tripCountries) || tripTitle,
      tripDateFrom,
      tripDateTo,
    };
  }, [activeClient, clientInterests, selectedClientId, tripCities, tripCountries, tripTitle, tripDateFrom, tripDateTo]);

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

  const handleLoadTemplate = useCallback(() => {
    if (!selectedTemplateId) {
      setSaveNotice('اختر قالباً من القائمة أولاً.');
      return;
    }
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const applied = applyTemplateToBuilder(template, { currentDateFrom: tripDateFrom });
    setItineraryDays(applied.days);
    if (applied.destination) {
      const dest = applied.destination.trim();
      if (dest) {
        setTripCities([dest]);
        setCustomCitiesText(dest);
      }
    }
    if (applied.hotels.length > 0) setHotels(applied.hotels);
    if (applied.datesFrom) setTripDateFrom(applied.datesFrom);
    if (applied.datesTo) setTripDateTo(applied.datesTo);
    setSaveNotice(`تم استدعاء القالب: ${template.title}`);
  }, [selectedTemplateId, templates, tripDateFrom, setItineraryDays]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!supabase) return;

    const templateName = templateSaveTitle.trim();
    if (!templateName) {
      setSaveNotice('يرجى إدخال اسم للقالب أولاً');
      return;
    }

    setTemplateBusy(true);
    setSaveNotice(null);
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
      });
      const { templates: refreshed } = await fetchItineraryTemplates(supabase);
      setTemplates(refreshed);
      setSaveNotice('تم حفظ القالب بنجاح.');
    } catch (e) {
      setSaveNotice(e instanceof Error ? e.message : 'فشل حفظ القالب.');
    } finally {
      setTemplateBusy(false);
    }
  }, [
    templateSaveTitle,
    geographyDestinationLabel,
    flightArrivalCity,
    itineraryDays,
    hotels,
    originCity,
    departureTime,
    arrivalTime,
    gate,
    seat,
    pnr,
    flightNumber,
    terminal,
    flightClass,
    departureCountry,
    arrivalCountry,
  ]);

  const handleSave = useCallback(async () => {
    if (!supabase) {
      setSaveNotice('قاعدة البيانات غير مهيأة.');
      return;
    }

    if (!tripKind) {
      setSaveNotice('اختر نوع المسار أولاً: رحلة خاصة أو رحلة جماعية.');
      return;
    }

    if (tripKind === 'private') {
      if (!selectedQuoteId) {
        setSaveNotice('للرحلة الخاصة يجب اختيار عرض السعر / اسم العميل المرتبط.');
        return;
      }
    }

    if (tripKind === 'group') {
      if (!selectedGroupId) {
        setSaveNotice('للرحلة الجماعية يجب اختيار قروب جاهز من القائمة.');
        return;
      }
    }

    setSaving(true);
    setSaveNotice(null);

    const passcode = accessCode.trim().toUpperCase();
    const serializedDays = itineraryDaysToDaysData(itineraryDays);

    const destinationSummary = buildDestinationSummary(tripCities, tripCountries) || tripTitle;
    const isGroupSave = tripKind === 'group';
    const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);
    const selectedGroup = readyGroups.find((g) => g.id === selectedGroupId);
    const privateClientId =
      !isGroupSave ? coerceClientIdForItinerarySave(selectedClientId) : null;
    const groupLabel =
      groupTourName.trim() ||
      selectedGroup?.title_ar ||
      selectedGroup?.title_en ||
      'رحلة جماعية';

    const payload = buildStrictSimpleItineraryInsertPayload({
      daysData: serializedDays,
      budget: isGroupSave ? '' : budget,
      paid: isGroupSave ? '' : paid,
      departureTime,
      arrivalTime,
      bookingRef: pnr,
      passcode,
      title:
        tripTitle ||
        (isGroupSave ? groupLabel : selectedQuote?.title) ||
        destinationSummary,
      destination: destinationSummary,
      geoTripType,
      countries: tripCountries,
      cities: tripCities,
      datesFrom: tripDateFrom,
      datesTo: tripDateTo,
      originCity,
      arrivalCity: normalizeSingleArrivalCity(flightArrivalCity),
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
      customerName: isGroupSave
        ? groupLabel
        : activeClient?.name
          ? String(activeClient.name)
          : selectedQuote?.client_name || 'عميل VIP',
      clientId: privateClientId,
      expertId: expertId.trim() || null,
      tripType: isGroupSave ? 'Group' : 'Individual',
      quoteId: isGroupSave ? null : selectedQuoteId || null,
      groupName: isGroupSave ? groupLabel : null,
      preTripServices,
      includeWardrobe: false,
      documents,
      supplierRequests,
      ticketDetails: activityTickets,
      showFashionServices: false,
      isMedical: itineraryHasMedicalPreTrip(preTripServices),
    });

    try {
      console.log('🔥 SAVING ITINERARY PAYLOAD:', payload);
      console.log('[builder] client state:', { selectedClientId, privateClientId });

      let res = await supabase.from('itineraries').insert(payload).select('id').single();
      if (res.error && /column|schema cache|does not exist/i.test(res.error.message ?? '')) {
        res = await supabase
        .from('itineraries')
          .insert(stripItineraryPayloadForSchemaError(res.error.message ?? '', payload))
          .select('id')
        .single();
      }
      if (res.error) {
        console.error('DB Save Error:', res.error);
        const msg = formatSupabaseSaveError(res.error);
        window.alert(`فشل الحفظ في قاعدة البيانات: ${msg}`);
        throw new Error(msg);
      }

      const itineraryId = res.data?.id;
      if (itineraryId != null && !isGroupSave) {
        const linkResult = await saveItineraryClientLinkAction(
          itineraryId,
          selectedClientId || null,
        );
        if (!linkResult.ok) {
          console.error('[builder] client_id save failed:', linkResult.error);
          window.alert(
            linkResult.columnMissing
              ? linkResult.error
              : `فشل ربط العميل: ${linkResult.error}`,
          );
          throw new Error(linkResult.error);
        }
        console.log('[builder] client_id saved:', linkResult.client_id);
      }

      setSaveNotice('تم حفظ المسار بنجاح.');
      window.alert('تم حفظ المسار بنجاح!');
      if (itineraryId != null) {
        router.push(`/crm/itineraries/${itineraryId}/edit`);
      }
    } catch (e) {
      console.error('Unexpected save error:', e);
      setSaveNotice(e instanceof Error ? e.message : 'فشل حفظ المسار.');
    } finally {
      setSaving(false);
    }
  }, [
    accessCode,
    tripTitle,
    tripKind,
    selectedQuoteId,
    selectedGroupId,
    groupTourName,
    quotes,
    readyGroups,
    geoTripType,
    tripCountries,
    tripCities,
    flightArrivalCity,
    tripDateFrom,
    tripDateTo,
    originCity,
    budget,
    paid,
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
    activeClient,
    selectedClientId,
    router,
    preTripServices,
    documents,
    supplierRequests,
    activityTickets,
    expertId,
  ]);

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

  // --- 5. واجهة المستخدم ---
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E2720] p-8 font-sans" dir="rtl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#0B1511]/20 hover:bg-slate-50 hover:text-[#0B1511]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            العودة للصفحة السابقة
          </button>
          <h1 className="text-3xl font-bold text-gray-900">مساحة بناء المسار الذكي</h1>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || quoteLoading}
          className="rounded-lg bg-[#0B1511] px-8 py-3 font-bold text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
        </button>
      </div>

      {saveNotice ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${
            saveNotice.includes('نجاح') || saveNotice.includes('تم حفظ')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {saveNotice}
        </div>
      ) : null}

      {/* نوع المسار — إلزامي قبل البناء */}
      <section className="mb-6 rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-l from-white to-[#FEFDF9] p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A84C]">
          Step 1 · Trip Type
        </p>
        <h2 className="mt-1 text-lg font-black text-[#1E2720]">نوع المسار</h2>
        <p className="mt-1 text-xs font-semibold text-gray-500">
          اختر نوع الرحلة قبل بناء المسار — يحدد الربط في قاعدة البيانات
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleTripKindChange('private')}
            className={`rounded-2xl border px-4 py-4 text-right transition ${
              isPrivate ? ACTIVE_TRIP_KIND : IDLE_TRIP_KIND
            }`}
            aria-pressed={isPrivate}
          >
            <span className="block text-sm font-black">رحلة خاصة — Private Trip</span>
            <span
              className={`mt-1 block text-[11px] font-semibold ${
                isPrivate ? 'text-[#D4AF37]/75' : 'text-gray-500'
              }`}
            >
              يُربط بعرض سعر معتمد — تُزامن البيانات تلقائياً
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleTripKindChange('group')}
            className={`rounded-2xl border px-4 py-4 text-right transition ${
              isGroup ? ACTIVE_TRIP_KIND : IDLE_TRIP_KIND
            }`}
            aria-pressed={isGroup}
          >
            <span className="block text-sm font-black">رحلة جماعية — Group Tour</span>
            <span
              className={`mt-1 block text-[11px] font-semibold ${
                isGroup ? 'text-[#D4AF37]/75' : 'text-gray-500'
              }`}
            >
              اختيار من القروبات الجاهزة · كود القروب · بدون ملخص مالي فردي
            </span>
          </button>
        </div>

        {/* رحلة خاصة: اسم العميل / عرض السعر */}
        {isPrivate ? (
          <div className="mt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700">
                اسم العميل / عرض السعر <span className="text-red-500">*</span>
              </span>
              <select
                value={selectedQuoteId}
                onChange={(e) => handleQuoteSelect(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:border-[#D4AF37]"
                required
              >
                <option value="">— اختر العميل من العروض —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.client_name} — {q.title}
                  </option>
                ))}
              </select>
            </label>
            {quoteLoading ? (
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#0B1511]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                جاري مزامنة بيانات العرض…
              </p>
            ) : null}
            {selectedQuoteId && quoteFieldsLocked && !quoteLoading ? (
              <p className="mt-2 text-xs font-bold text-[#0B1511]">
                تمت المزامنة من العرض ·{' '}
                {quotes.find((q) => q.id === selectedQuoteId)?.client_name} · #
                {selectedQuoteId.slice(0, 8)}
              </p>
            ) : null}
            {selectedClientId ? (
              <p className="mt-2 rounded-lg border border-[#D4AF37]/25 bg-[#FFFBF0] px-3 py-2 text-xs font-bold text-[#1E2720]">
                العميل المرتبط بالمسار: {activeClient?.name || `عميل #${selectedClientId}`} — سيظهر
                زر «الملف الشخصي» في بوابة العميل عند الحفظ.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* رحلة جماعية: اختيار من القروبات الجاهزة فقط */}
        {isGroup ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">
              اختر القروب <span className="text-red-500">*</span>
            </span>
            <select
              value={selectedGroupId}
              onChange={(e) => handleReadyGroupSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold text-gray-900 outline-none focus:border-[#D4AF37]"
              required
            >
              <option value="">— اختر قروباً جاهزاً —</option>
              {readyGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title_ar || g.title_en}
                  {g.dates_ar ? ` · ${g.dates_ar}` : ''}
                </option>
              ))}
            </select>
            {readyGroups.length === 0 ? (
              <span className="mt-1 block text-[11px] font-semibold text-amber-800">
                لا توجد قروبات نشطة — أضف قروباً من صفحة القروبات السياحية أولاً.
              </span>
            ) : selectedGroupId ? (
              <span className="mt-1 block text-[11px] font-semibold text-[#0B1511]">
                القروب المحدد: {groupTourName}
              </span>
            ) : null}
          </label>
        ) : null}

        {!tripKind ? (
          <p className="mt-4 text-xs font-bold text-amber-800">
            يجب اختيار نوع المسار قبل حفظ الرحلة.
          </p>
        ) : null}
      </section>

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
              titleReadOnly={quoteFieldsLocked}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">
                خبير الوجهة (مصمم المسار)
              </label>
              <select
                name="expert_id"
                value={expertId || ''}
                disabled={saving}
                onChange={(e) => setExpertId(e.target.value)}
                className={BUILDER_FIELD}
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
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                className={`w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light] ${
                  quoteFieldsLocked ? LOCKED_FIELD : ''
                }`}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</label>
              <input
                type="date"
                value={tripDateTo}
                onChange={(e) => setTripDateTo(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                className={`w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-[#D4AF37] [color-scheme:light] ${
                  quoteFieldsLocked ? LOCKED_FIELD : ''
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* كود الدخول — للخاصة والجماعية (تسمية مختلفة فقط) */}
      {tripKind ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#FEFDF9] px-5 py-3 shadow-sm">
          <span className="text-sm font-bold text-gray-700">
            {isGroup ? 'كود القروب' : 'كود العميل'}
          </span>
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
        </div>
      ) : null}

      {/* الملخص المالي — رحلة خاصة فقط */}
      {isPrivate ? (
        <section className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#1E2720]">
            <span>💰</span> الملخص المالي للحجز
            {quoteFieldsLocked ? (
              <span className="rounded-full bg-[#0B1511]/5 px-2 py-0.5 text-[10px] font-black text-[#0B1511]">
                من عرض السعر
              </span>
            ) : null}
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-600">الميزانية الإجمالية</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                placeholder="مثال: 50000"
                className={`rounded-lg border border-gray-300 p-3 font-bold text-gray-900 focus:border-[#D4AF37] ${
                  quoteFieldsLocked ? LOCKED_FIELD : 'bg-gray-50'
                }`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-600">المدفوع من العميل</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                placeholder="مثال: 20000"
                className={`rounded-lg border border-gray-300 p-3 font-bold text-emerald-800 focus:border-emerald-500 ${
                  quoteFieldsLocked ? LOCKED_FIELD : 'bg-gray-50'
                }`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-600">المتبقي</label>
              <div
                className={`rounded-lg border p-3 text-lg font-bold ${
                  remaining > 0
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {remaining.toLocaleString('ar-SA')} ر.س
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* القوالب الجاهزة — متاحة دائماً قبل الحفظ */}
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
              className={BUILDER_FIELD}
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
              className={BUILDER_FIELD}
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

      </section>

      {/* الأقسام المشتركة دائماً: بوردينق، أيام، أماكن، موردين، فعاليات، كونسيرج… */}
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
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">دولة المغادرة</span>
            <input
              type="text"
              value={departureCountry}
              onChange={(e) => setDepartureCountry(e.target.value)}
              placeholder="السعودية"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-sm font-bold text-gray-600">
              إلى مدينة (رحلة الطيران — مدينة واحدة)
                        </span>
                  <input
              type="text"
              list="builder-flight-arrival-city-suggestions"
              value={flightArrivalCity}
              onChange={(e) => setFlightArrivalCity(e.target.value)}
              onBlur={(e) =>
                setFlightArrivalCity(normalizeSingleArrivalCity(e.target.value))
              }
              placeholder={tripCities[0] ? `مثال: ${tripCities[0]}` : 'مثال: سيول'}
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
            {tripCities.length > 0 ? (
              <datalist id="builder-flight-arrival-city-suggestions">
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
            <span className="text-sm font-bold text-gray-600">دولة الوصول</span>
            <input
              type="text"
              value={arrivalCountry}
              onChange={(e) => setArrivalCountry(e.target.value)}
              placeholder="هنغاريا"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">رقم الرحلة</span>
            <input
              type="text"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="SV130"
              dir="ltr"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">المبنى</span>
            <input
              type="text"
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
              placeholder="T1"
              dir="ltr"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">الدرجة</span>
            <select
              value={flightClass}
              onChange={(e) => setFlightClass(e.target.value)}
              dir="ltr"
              className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 focus:border-[#D4AF37] outline-none"
            >
              <option value="">— اختر —</option>
              {FLIGHT_CLASS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت المغادرة</span>
            <VipTimeSlotSelect
              value={departureTime}
              onChange={setDepartureTime}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-600">وقت الوصول</span>
            <VipTimeSlotSelect
              value={arrivalTime}
              onChange={setArrivalTime}
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
          destinationLabel={geographyDestinationLabel}
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

      <ItineraryDocumentWallet
        documents={documents}
        onChange={setDocuments}
        onNotice={setSaveNotice}
      />

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
      <div className="flex gap-6 h-[750px]">
        {/* بنك الأماكن (اليمين) */}
        <aside className="w-[35%] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
            <h3 className="font-bold text-lg">بنك الأماكن ({displayedPlaces.length} مكان متاح)</h3>
            
            {/* شريط البحث */}
            <input 
              type="text" 
              placeholder="ابحث بالاسم أو الحي..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 p-3 rounded-lg w-full focus:border-[#D4AF37] outline-none"
            />
            
            {/* الفلاتر الذكية (تم إصلاح الخلل هنا) */}
            <div className="flex gap-2">
              <select 
                value={filterCity} 
                onChange={(e) => { setFilterCity(e.target.value); setFilterCategory(''); }}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل المدن</option>
                {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

                              <select
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 bg-white border border-gray-300 text-sm rounded-lg p-2"
              >
                <option value="">كل الفئات</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
          onMoveDay={moveDay}
          onRemovePlace={handleRemovePlace}
          onUpdateDayHotel={updateDayHotel}
          onUpdateDayCity={updateDayCity}
          onUpdateDayTitle={updateDayTitle}
          onUpdateTransport={updateTransport}
          onUpdateVisitTime={updateVisitTime}
          dayDroppableId={dayDroppableId}
          supplierBrief={supplierBrief}
          predictiveWishContext={predictiveWishContext}
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
            clientName: activeClient?.name ? String(activeClient.name) : undefined,
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