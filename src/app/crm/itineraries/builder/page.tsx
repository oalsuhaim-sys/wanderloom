'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DragDropContext } from '@hello-pangea/dnd';
import { ArrowRight, Copy, FileStack, Loader2, Plus, Trash2 } from 'lucide-react';

import { getQuoteLedgerAction } from '@/app/actions/invoiceActions';
import { saveItineraryClientLinkAction } from '@/app/actions/itineraryClientActions';
import { toast } from '@/lib/crm-toast';
import SimpleItineraryDayPlanner from '@/app/crm/itineraries/_components/SimpleItineraryDayPlanner';
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
import SupplierRequestsEditor from '@/app/crm/itineraries/_components/SupplierRequestsEditor';
import { normalizeSingleArrivalCity } from '@/lib/vip-flight-voucher';
import { QuickAddPlaceModal, useQuickAddPlace } from '@/app/crm/itineraries/_components/useQuickAddPlace';
import {
  createEmptyDay,
  createEmptyHotelEntry,
  hotelsToDetailsPayload,
  type ItineraryHotelEntry,
  type SimpleItineraryDay,
  placeNotesToStopPayload,
  readPlaceNotesFromStop,
  withTransportDefaults,
} from '@/app/crm/itineraries/_components/simple-itinerary-day-utils';
import { useSimpleItineraryDays } from '@/app/crm/itineraries/_components/useSimpleItineraryDays';
import {
  buildSupplierBriefClientContext,
  type SupplierBriefClientContext,
} from '@/lib/supplier-whatsapp-brief';
import {
  buildStrictSimpleItineraryInsertPayload,
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
import { activityTicketsFromQuotation, type ActivityTicket } from '@/lib/itinerary-tickets';
import { type SupplierRequest } from '@/lib/supplier-requests';
import { fetchCrmSuppliers, type CrmSupplier } from '@/lib/crm-suppliers';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import {
  PLACE_CATEGORY_OPTIONS,
  PLACES_BANK_PAGE_SIZE,
  fetchPlacesBankCityOptions,
  fetchPlacesBankPage,
} from '@/lib/places-bank';
import { coerceClientIdForItinerarySave } from '@/lib/itinerary-client-crm';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { supabase } from '@/lib/supabase';
import {
  WL_BTN_DANGER,
  WL_BTN_PRIMARY,
  WL_BTN_SECONDARY,
  WL_CARD,
  WL_EMPTY,
  WL_HINT,
  WL_INPUT,
  WL_DATE_INPUT,
  WL_LABEL,
  WL_OPTION,
  WL_PAGE,
  WL_SECTION,
  WL_SELECT,
  WL_TEXTAREA,
  WL_TITLE,
  WL_TOGGLE_ACTIVE,
  WL_TOGGLE_BASE,
  WL_TOGGLE_INACTIVE,
} from '@/lib/itinerary-builder-ui';

const ACTIVE_TRIP_KIND = `${WL_TOGGLE_BASE} ${WL_TOGGLE_ACTIVE} border border-[#D4AF37] ring-2 ring-[#D4AF37]/35`;
const IDLE_TRIP_KIND = `${WL_TOGGLE_BASE} ${WL_TOGGLE_INACTIVE}`;
const ACTIVE_TRIP_KIND_TITLE = 'block text-sm font-black text-slate-950';
const IDLE_TRIP_KIND_TITLE = 'block text-sm font-black text-slate-100';
const ACTIVE_TRIP_KIND_SUB = 'mt-1 block text-xs font-semibold text-slate-800';
const IDLE_TRIP_KIND_SUB = 'mt-1 block text-xs font-semibold text-slate-500';
const LOCKED_FIELD =
  'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500 opacity-80';
const BUILDER_FIELD = WL_INPUT;

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
      ...placeNotesToStopPayload(p.notes),
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
        <div className="itinerary-builder-page flex min-h-[50vh] items-center justify-center gap-2 bg-[#f8fafc] text-sm font-bold text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" aria-hidden />
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
  const [places, setPlaces] = useState<Record<string, unknown>[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placesPage, setPlacesPage] = useState(0);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [expertsList, setExpertsList] = useState<ExpertMini[]>([]);
  const [expertsLoadError, setExpertsLoadError] = useState<string | null>(null);
  const [expertId, setExpertId] = useState('');
  const [expertName, setExpertName] = useState('');
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [readyGroups, setReadyGroups] = useState<ReadyGroupOption[]>([]);
  /** null حتى يختار الأدمن — إلزامي قبل الحفظ */
  const [tripKind, setTripKind] = useState<BuilderTripKind | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupTripName, setGroupTripName] = useState('');
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
  const [placesSourceTab, setPlacesSourceTab] = useState<ItineraryPlacesSource>('bank');

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
    movePlaceToDay,
    updateTransport,
    updateVisitTime,
    updatePlaceNotes,
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
        } catch {
          /* templates optional */
        }

        try {
          const supplierRows = await fetchCrmSuppliers(supabase);
          setAllSuppliers(supplierRows);
        } catch {
          /* suppliers optional */
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

        if (expertsError) {
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

  function applyDestinationsToGeography(
    destLabels: string[],
    opts?: { fillTitle?: boolean; force?: boolean },
  ) {
    const labels = (destLabels ?? []).map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!labels.length) return;
    const geo = geographyFromDestinationLabels(labels);
    const force = Boolean(opts?.force);
    setGeoTripType(geo.geoTripType);
    setTripCountries((prev) => (prev.length && !force ? prev : geo.countries));
    setTripCities((prev) => (prev.length && !force ? prev : geo.cities));
    if (geo.cities.length) {
      setCustomCitiesText((prev) => (prev.trim() && !force ? prev : geo.cities.join('، ')));
    }
    if (opts?.fillTitle) {
      const titleHint = geo.cities[0] || geo.countries[0] || labels[0] || '';
      if (titleHint) {
        setTripTitle((prev) => (prev.trim() ? prev : `رحلة ${titleHint}`));
      }
    }
  }

  /** When a client is linked — auto-fill country/city/destination from target_trip / DNA */
  useEffect(() => {
    if (tripKind !== 'private' || !selectedClientId || !supabase) return;
    // Don't overwrite geography already set from quote sync / URL prefill
    if (tripCountries.length || tripCities.length) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('target_trip, name, travel_dna')
          .eq('id', selectedClientId)
          .maybeSingle();
        if (cancelled || !clientRow) return;

        const row = clientRow as Record<string, unknown>;
        const targetTrip = String(row.target_trip ?? '').trim();
        let dnaDest = '';
        const dnaRaw = row.travel_dna;
        if (dnaRaw && typeof dnaRaw === 'object' && !Array.isArray(dnaRaw)) {
          const dna = dnaRaw as Record<string, unknown>;
          dnaDest = String(
            dna.destination ?? dna.preferred_destination ?? dna.target_trip ?? '',
          ).trim();
        }

        // Also try latest lead destinations for this client
        let leadDests: string[] = [];
        const byClient = await supabase
          .from('leads')
          .select('destinations, created_at')
          .eq('client_id', selectedClientId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!byClient.error && Array.isArray(byClient.data) && byClient.data[0]) {
          const d = (byClient.data[0] as { destinations?: unknown }).destinations;
          if (Array.isArray(d)) {
            leadDests = d.map((x) => String(x ?? '').trim()).filter(Boolean);
          } else if (typeof d === 'string' && d.trim()) {
            leadDests = [d.trim()];
          }
        }

        const labels = [
          ...leadDests,
          ...(targetTrip ? [targetTrip] : []),
          ...(dnaDest ? [dnaDest] : []),
        ];
        if (!labels.length) return;
        if (cancelled) return;
        applyDestinationsToGeography(labels, { fillTitle: true });
      } catch (err) {
        console.warn('[builder] client destination autofill:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId, tripKind, tripCountries.length, tripCities.length]);

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
      applyDestinationsToGeography(urlPrefill.destinations, { force: true });
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
      setGroupTripName('');
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
      setGroupTripName('');
      return;
    }
    const title = group.title_ar || group.title_en || 'رحلة جماعية';
    setGroupTripName(title);
    setTripTitle(title);

    const destLabels = [
      ...extractGroupDestinationCities(group.title_ar, group.title_en),
      group.title_ar,
      group.title_en,
    ].filter(Boolean);
    if (destLabels.length) {
      applyDestinationsToGeography(destLabels, { force: true });
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
          applyDestinationsToGeography(row.destinations, { force: true });
        } else {
          // Fallback: infer geography from client target_trip when quote has no destinations
          const clientId = row.client_id;
          if (clientId && supabase) {
            const { data: clientRow } = await supabase
              .from('clients')
              .select('target_trip')
              .eq('id', clientId)
              .maybeSingle();
            const targetTrip = String(
              (clientRow as { target_trip?: unknown } | null)?.target_trip ?? '',
            ).trim();
            if (targetTrip) {
              applyDestinationsToGeography([targetTrip], { force: true, fillTitle: true });
            }
          }
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

        const importedTickets = activityTicketsFromQuotation({
          activity_options: row.activity_options,
          activities_proposals: row.activities_proposals,
          activities:
            (data as Record<string, unknown>).activities ??
            (data as Record<string, unknown>).activities_details,
          start_date: row.start_date,
        });
        if (importedTickets.length > 0) {
          setActivityTickets(importedTickets);
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
          console.error('[builder] Failed to load places inventory', error);
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

  // --- 3. قوائم الفلاتر ---
  const uniqueCities = cityOptions;

  const displayedPlaces = places;
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
        applyDestinationsToGeography([dest], { force: true });
        if (!tripTitle.trim()) setTripTitle(dest);
      }
    }
    if (applied.hotels.length > 0) setHotels(applied.hotels);
    if (applied.datesFrom) setTripDateFrom(applied.datesFrom);
    if (applied.datesTo) setTripDateTo(applied.datesTo);
    setSaveNotice(`تم استدعاء القالب: ${template.title}`);
  }, [selectedTemplateId, templates, tripDateFrom, tripTitle, setItineraryDays]);

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
      groupTripName.trim() ||
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
      expertName:
        expertName.trim() ||
        expertsList.find((e) => String(e.id) === String(expertId))?.name?.trim() ||
        null,
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
      console.log('[builder] itinerary save payload expert:', {
        expert_id: payload.expert_id,
        expert_name: payload.expert_name,
        flight_expert: (payload.flight_details as { expert_name?: string } | undefined)
          ?.expert_name,
        days_meta: (payload.days_data as { meta?: unknown } | undefined)?.meta,
      })
      let res = await supabase.from('itineraries').insert(payload).select('id').single()
      let attemptPayload = payload
      for (let attempt = 0; attempt < 3; attempt++) {
        if (
          !res.error ||
          !/column|schema cache|does not exist|foreign key|expert_id|expert_name/i.test(
            res.error.message ?? '',
          )
        ) {
          break
        }
        attemptPayload = stripItineraryPayloadForSchemaError(
          res.error.message ?? '',
          attemptPayload,
        )
        res = await supabase
          .from('itineraries')
          .insert(attemptPayload)
          .select('id')
          .single()
      }
      if (res.error) {
        console.error('DB Save Error:', res.error)
        const msg = formatSupabaseSaveError(res.error)
        toast.error(`فشل الحفظ في قاعدة البيانات: ${msg}`)
        throw new Error(msg)
      }

      const itineraryId = res.data?.id
      // Best-effort column sync (name must appear in Command Center even if FK blocked)
      if (itineraryId != null && (expertId.trim() || expertName.trim())) {
        const resolvedName =
          expertName.trim() ||
          expertsList.find((e) => String(e.id) === String(expertId))?.name?.trim() ||
          ''
        const expertPatch: Record<string, unknown> = {}
        if (expertId.trim()) expertPatch.expert_id = expertId.trim()
        if (resolvedName) expertPatch.expert_name = resolvedName
        if (Object.keys(expertPatch).length) {
          const patchRes = await supabase
            .from('itineraries')
            .update(expertPatch)
            .eq('id', itineraryId)
          if (patchRes.error) {
            // Column/FK may be unavailable — days_data / flight_details already hold the name
            console.warn('[builder] expert column patch skipped:', patchRes.error.message)
          }
        }
      }
      if (itineraryId != null && !isGroupSave) {
        const linkResult = await saveItineraryClientLinkAction(
          itineraryId,
          selectedClientId || null,
        );
        if (!linkResult.ok) {
          console.error('[builder] client_id save failed:', linkResult.error);
          toast.error(
            linkResult.columnMissing
              ? linkResult.error
              : `فشل ربط العميل: ${linkResult.error}`,
          );
          throw new Error(linkResult.error);
        }
      }

      setSaveNotice('تم حفظ المسار بنجاح.');
      toast.success('تم حفظ المسار بنجاح!');
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
    groupTripName,
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
    expertName,
    expertsList,
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
    <div className={`${WL_PAGE} font-sans`} dir="rtl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || quoteLoading}
          className={WL_BTN_PRIMARY}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
        </button>
      </div>

      {saveNotice ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${
            saveNotice.includes('نجاح') || saveNotice.includes('تم حفظ')
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
              : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
          }`}
        >
          {saveNotice}
        </div>
      ) : null}

      {/* نوع المسار — إلزامي قبل البناء */}
      <section className={`mb-6 ${WL_SECTION}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]/80">
          Step 1 · Trip Type
        </p>
        <h2 className={WL_TITLE}>نوع المسار</h2>
        <p className={WL_HINT}>
          اختر نوع الرحلة قبل بناء المسار — يحدد الربط في قاعدة البيانات
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleTripKindChange('private')}
            className={`rounded-2xl px-4 py-4 text-right transition ${
              isPrivate ? ACTIVE_TRIP_KIND : IDLE_TRIP_KIND
            }`}
            aria-pressed={isPrivate}
          >
            <span className={isPrivate ? ACTIVE_TRIP_KIND_TITLE : IDLE_TRIP_KIND_TITLE}>
              رحلة خاصة — Private Trip
            </span>
            <span className={isPrivate ? ACTIVE_TRIP_KIND_SUB : IDLE_TRIP_KIND_SUB}>
              يُربط بعرض سعر معتمد — تُزامن البيانات تلقائياً
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleTripKindChange('group')}
            className={`rounded-2xl px-4 py-4 text-right transition ${
              isGroup ? ACTIVE_TRIP_KIND : IDLE_TRIP_KIND
            }`}
            aria-pressed={isGroup}
          >
            <span className={isGroup ? ACTIVE_TRIP_KIND_TITLE : IDLE_TRIP_KIND_TITLE}>
              رحلة جماعية — Group Tour
            </span>
            <span className={isGroup ? ACTIVE_TRIP_KIND_SUB : IDLE_TRIP_KIND_SUB}>
              اختيار من القروبات الجاهزة · كود القروب · بدون ملخص مالي فردي
            </span>
          </button>
        </div>

        {/* رحلة خاصة: اسم العميل / عرض السعر */}
        {isPrivate ? (
          <div className="mt-4">
            <label className="block">
              <span className={WL_LABEL}>
                اسم العميل / عرض السعر <span className="text-red-400">*</span>
              </span>
              <select
                value={selectedQuoteId}
                onChange={(e) => handleQuoteSelect(e.target.value)}
                className={WL_INPUT}
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
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#D4AF37]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                جاري مزامنة بيانات العرض…
              </p>
            ) : null}
            {selectedQuoteId && quoteFieldsLocked && !quoteLoading ? (
              <p className="mt-2 text-xs font-bold text-slate-600">
                تمت المزامنة من العرض ·{' '}
                {quotes.find((q) => q.id === selectedQuoteId)?.client_name} · #
                {selectedQuoteId.slice(0, 8)}
              </p>
            ) : null}
            {selectedClientId ? (
              <p className="mt-2 rounded-xl border border-[#D4AF37]/30 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                العميل المرتبط بالمسار: {activeClient?.name || `عميل #${selectedClientId}`} — سيظهر
                زر «الملف الشخصي» في بوابة العميل عند الحفظ.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* رحلة جماعية: اختيار من القروبات الجاهزة فقط */}
        {isGroup ? (
          <label className="mt-4 block">
            <span className={WL_LABEL}>
              اختر القروب <span className="text-red-400">*</span>
            </span>
            <select
              value={selectedGroupId}
              onChange={(e) => handleReadyGroupSelect(e.target.value)}
              className={WL_INPUT}
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
              <span className="mt-1 block text-[11px] font-semibold text-amber-300">
                لا توجد قروبات نشطة — أضف قروباً من صفحة القروبات السياحية أولاً.
              </span>
            ) : selectedGroupId ? (
              <span className="mt-1 block text-[11px] font-semibold text-slate-600">
                القروب المحدد: {groupTripName}
              </span>
            ) : null}
          </label>
        ) : null}

        {!tripKind ? (
          <p className="mt-4 text-xs font-bold text-amber-300">
            يجب اختيار نوع المسار قبل حفظ الرحلة.
          </p>
        ) : null}
      </section>

      <div className={`mb-8 ${WL_SECTION}`}>
        <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <label className={WL_LABEL}>خبير الوجهة (مصمم المسار)</label>
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
                  expertsLoadError ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {expertsLoadError
                  ? `تعذر تحميل الخبراء: ${expertsLoadError}`
                  : `تم تحميل ${expertsList.length} خبير من قاعدة البيانات`}
              </p>
            </div>

            <div className="min-w-0">
              <label className={WL_LABEL}>تاريخ البداية</label>
              <input
                type="date"
                value={tripDateFrom}
                onChange={(e) => setTripDateFrom(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                className={`${WL_DATE_INPUT} ${quoteFieldsLocked ? LOCKED_FIELD : ''}`}
              />
            </div>

            <div className="min-w-0">
              <label className={WL_LABEL}>تاريخ النهاية</label>
              <input
                type="date"
                value={tripDateTo}
                onChange={(e) => setTripDateTo(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                className={`${WL_DATE_INPUT} ${quoteFieldsLocked ? LOCKED_FIELD : ''}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* كود الدخول — للخاصة والجماعية (تسمية مختلفة فقط) */}
      {tripKind ? (
        <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${WL_SECTION} !py-4`}>
          <span className="text-sm font-bold text-slate-700">
            {isGroup ? 'كود القروب' : 'كود العميل'}
          </span>
          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-xl border border-[#D4AF37]/50 bg-slate-50 px-4 py-2">
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
        <section className={`mb-6 ${WL_SECTION}`}>
          <h3 className={WL_TITLE}>
            <span>💰</span> الملخص المالي للحجز
            {quoteFieldsLocked ? (
              <span className="rounded-full border border-[#D4AF37]/40 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-[#D4AF37]">
                من عرض السعر
              </span>
            ) : null}
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className={WL_LABEL}>الميزانية الإجمالية</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                placeholder="مثال: 50000"
                className={`${WL_INPUT} font-bold ${quoteFieldsLocked ? LOCKED_FIELD : ''}`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={WL_LABEL}>المدفوع من العميل</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                readOnly={quoteFieldsLocked}
                disabled={quoteFieldsLocked}
                placeholder="مثال: 20000"
                className={`${WL_INPUT} font-bold text-emerald-300 ${quoteFieldsLocked ? LOCKED_FIELD : ''}`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div
                className={`rounded-lg border bg-slate-50 p-3 text-right ${
                  remaining > 0 ? 'border-red-500/40' : 'border-emerald-500/40'
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
          </div>
        </section>
      ) : null}

      {/* القوالب الجاهزة — متاحة دائماً قبل الحفظ */}
      <section className={`mb-6 ${WL_SECTION}`}>
        <h3 className={WL_TITLE}>
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
              className={BUILDER_FIELD}
            />
            <button
              type="button"
              onClick={() => void handleSaveAsTemplate()}
              disabled={templateBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-slate-100 px-4 py-2.5 text-sm font-bold text-[#D4AF37] transition-all hover:bg-slate-200 disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {templateBusy ? 'جاري الحفظ…' : 'حفظ كقالب'}
            </button>
          </div>
        </div>
      </section>

      {/* الأقسام المشتركة دائماً: بوردينق، أيام، أماكن، موردين، فعاليات، كونسيرج… */}
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
          tripCities={tripCities}
          datalistId="builder-flight-arrival-city-suggestions"
        />

        <div className={`${WL_SECTION}`}>
          <h4 className={WL_TITLE}>🏨 الفنادق والإقامة</h4>
          <ItineraryHotelsEditor
            hotels={hotels}
            onChange={setHotels}
            supplierBrief={supplierBrief}
            filteredSuppliers={filteredSuppliers}
            destinationLabel={geographyDestinationLabel}
            tripCountries={tripCountries}
            tripCities={tripCities}
          />
        </div>
      </section>

      <section className={`mb-6 ${WL_SECTION}`}>
        <h3 className={WL_TITLE}>
          <span>🎟️</span> تذاكر الفعاليات والدخول
        </h3>
        <p className={`mb-4 ${WL_HINT}`}>
          مدن الألعاب، السيرك، المتاحف — تظهر للعميل في تبويب الحجوزات.
        </p>
        <ActivityTicketsEditor tickets={activityTickets} onChange={setActivityTickets} />
      </section>

      <ItineraryDocumentWallet
        documents={documents}
        onChange={setDocuments}
        onNotice={setSaveNotice}
      />

      <section className={`mb-6 ${WL_SECTION}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className={`${WL_TITLE} mb-0`}>
            <span>✨</span> خدمات الكونسيرج ما قبل السفر (VIP)
          </h3>
          <button
            type="button"
            onClick={() => setPreTripServices((prev) => [...prev, emptyPreTripService()])}
            className={WL_BTN_PRIMARY}
          >
            <Plus className="h-4 w-4" aria-hidden />
            إضافة خدمة
          </button>
        </div>
        <p className={`mb-4 ${WL_HINT}`}>
          مثل حجز صالون تجميل VIP قبل السفر — تظهر للعميل كقسائم فاخرة مع الموعد والموقع ورقم التواصل.
        </p>
        {preTripServices.length === 0 ? (
          <p className={WL_EMPTY}>
            لا توجد خدمات ما قبل السفر بعد. اضغط «إضافة خدمة».
          </p>
        ) : (
          <div className="space-y-4">
            {preTripServices.map((service, index) => (
              <div key={`pre-trip-${index}`} className={WL_CARD}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-[#D4AF37]">
                    خدمة #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreTripServices((prev) => prev.filter((_, i) => i !== index))
                    }
                    className={WL_BTN_DANGER}
                    aria-label="حذف الخدمة"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    حذف
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className={WL_LABEL}>عنوان الخدمة *</span>
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
                      className={WL_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={WL_LABEL}>موعد الحجز</span>
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
                      className={WL_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={WL_LABEL}>رقم التواصل</span>
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
                      className={WL_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className={WL_LABEL}>رابط الموقع (Google Maps)</span>
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
                      className={WL_INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 md:col-span-2">
                    <span className={WL_LABEL}>ملاحظة / تفاصيل</span>
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
                      className={WL_TEXTAREA}
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
        {/* بنك الأماكن (اليمين) */}
        <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:w-[35%]">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
            <ItineraryPlacesSourceTabs
              value={placesSourceTab}
              onChange={setPlacesSourceTab}
              placesCount={placesTotal}
            />

            {placesSourceTab === 'bank' ? (
              <>
            <h3 className="text-lg font-bold text-[#D4AF37]">
              بنك الأماكن
              {placesLoading ? ' · جاري التحميل…' : ''}
            </h3>
            
            {/* شريط البحث */}
            <input
              type="text"
              placeholder="ابحث بالاسم أو الحي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-bold text-slate-900 placeholder:text-slate-500 focus:border-[#D4AF37] focus:bg-white outline-none"
            />
            {/* الفلاتر الذكية (تم إصلاح الخلل هنا) */}
            <div className="flex gap-2">
              <select 
                value={filterCity} 
                onChange={(e) => { setFilterCity(e.target.value); setFilterCategory(''); }}
                className={`flex-1 ${WL_SELECT}`}
              >
                <option value="" className={WL_OPTION}>كل المدن</option>
                {uniqueCities.map(c => <option key={c} value={c} className={WL_OPTION}>{c}</option>)}
              </select>

                              <select
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`flex-1 ${WL_SELECT}`}
              >
                <option value="" className={WL_OPTION}>كل الفئات</option>
                {PLACE_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id} className={WL_OPTION}>
                    {c.label}
                  </option>
                ))}
                              </select>
                            </div>
            {placesTotal > PLACES_BANK_PAGE_SIZE ? (
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  disabled={placesPage <= 0 || placesLoading}
                  onClick={() => setPlacesPage((p) => Math.max(0, p - 1))}
                  className={WL_BTN_SECONDARY}
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
                  className={WL_BTN_SECONDARY}
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
              defaultDestination={filterCity || tripCities[0] || ''}
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
          onMovePlaceToDay={movePlaceToDay}
          onUpdateDayHotel={updateDayHotel}
          onUpdateDayCity={updateDayCity}
          onUpdateDayTitle={updateDayTitle}
          onUpdateTransport={updateTransport}
          onUpdateVisitTime={updateVisitTime}
          onUpdatePlaceNotes={updatePlaceNotes}
          dayDroppableId={dayDroppableId}
          supplierBrief={supplierBrief}
          predictiveWishContext={predictiveWishContext}
          onApplyPredictiveWish={(place) => handleAddPlace(place, activeDayId)}
        />
              </div>
      </DragDropContext>

      <section className={`mb-6 ${WL_SECTION}`}>
        <h3 className={WL_TITLE}>إدارة الموردين والطلبات الخاصة</h3>
        <p className={`mb-4 ${WL_HINT}`}>
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