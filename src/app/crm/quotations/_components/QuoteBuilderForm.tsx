'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Link2,
  Loader2,
  Plane,
  Plus,
  Receipt,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { canEditItineraries } from '@/lib/crm-permissions';
import { supabase } from '@/lib/supabase';
import { getClientAccessToken } from '@/lib/crm-session-token';
import { isEmployeeAdminRole, isEmployeeExpertRole } from '@/lib/crm-roles';
import { cascadeQuotationDatesToItineraries } from '@/lib/cascade-quotation-dates-to-itinerary';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';
import {
  calculateProfitFromMargin,
  calculateQuotationGrandTotal,
  createEmptyFlightProposal,
  ensureProposalRows,
  fetchQuotationById,
  fetchQuotationHotelPlaces,
  hotelExistsInQuotationPlaces,
  isQuotationPersisted,
  isQuotationStatusApproved,
  isQuoteSavedId,
  normalizeQuotationId,
  quotationEditId,
  resolveQuotationClientId,
  serializeActivityProposalsForSave,
  serializeFlightProposalsForSave,
  serializeHotelProposalsForSave,
  serializeTransportProposalsForSave,
  silentInsertQuotationHotelPlace,
  sumProposalPrices,
  QUOTATION_STATUS_LABEL,
  type QuotationActivityProposal,
  type QuotationFlightProposal,
  type QuotationHotelPlace,
  type QuotationHotelProposal,
  type QuotationRow,
  type QuotationStatus,
  type QuotationTransportProposal,
} from '@/lib/crm-quotations';
import { setQuotationLifecycleAction } from '@/app/actions/quotationActions';
import { listInvoicesForQuoteAction } from '@/app/actions/invoiceActions';
import { GenerateInvoiceModal } from '@/app/crm/quotations/_components/GenerateInvoiceModal';
import { InteractiveBrochureEditor } from '@/app/crm/quotations/_components/InteractiveBrochureEditor';
import { ReceiptVerificationPanel } from '@/app/crm/quotations/_components/ReceiptVerificationPanel';
import {
  buildFeedbackLabelMaps,
  ClientFeedbackAlert,
} from '@/app/crm/quotations/_components/ClientFeedbackPanel';
import { QuoteFinancialSummaryCard } from '@/app/crm/quotations/_components/QuoteFinancialSummaryCard';
import { QuoteInvoiceHistoryTable } from '@/app/crm/quotations/_components/QuoteInvoiceHistoryTable';
import {
  createEmptyActivityOption,
  createEmptyCostLine,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyTransportOption,
  emptyClientFeedback,
  hasClientFeedback,
  serializeActivityOptionsForSave,
  serializeCostBreakdownForSave,
  serializeHotelOptionsForSave,
  serializeItineraryDaysForSave,
  serializeTransportOptionsForSave,
  type QuotationActivityOption,
  type QuotationClientFeedback,
  type QuotationCostLine,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import { type InvoiceRow } from '@/lib/crm-invoices';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_SELECT_CLASS } from '@/lib/lead-source';
import {
  calculateHotelsGroupTotal,
  parseDirectCosts,
  parseFixedCosts,
  parseHotelsList,
  type GroupPricingRow,
} from '@/lib/group-pricings';

type SavedGroupPricingListItem = {
  id: string;
  title: string | null;
  final_selling_price_per_pax: number | null;
  total_group_revenue: number | null;
  passengers_count: number | null;
  created_at: string | null;
};

function money2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Group pricing uses margin-on-selling; quote builder uses cost-plus %. */
function groupMarginToQuoteCostPlusPercent(groupMarginPercent: number): number {
  const m = groupMarginPercent / 100;
  if (m > 0 && m < 1) {
    return Math.round((m / (1 - m)) * 1000) / 10;
  }
  return Math.round(groupMarginPercent * 10) / 10;
}

/** Admin lifecycle control — maps product labels to quotations.status values */
const ADMIN_STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'pending_client', label: 'قيد التسعير / بانتظار العميل' },
  { value: 'needs_revision', label: 'يحتاج تعديلاً' },
  { value: 'approved', label: 'معتمدة / تمت الموافقة' },
  { value: 'awaiting_payment', label: 'بانتظار الدفع' },
  { value: 'payment_confirmed', label: 'تم تأكيد الدفع' },
  { value: 'draft', label: 'مستبعدة' },
];

function isClientReviewStatus(status: QuotationStatus): boolean {
  return status === 'needs_revision' || status === 'client_responded';
}

function isInvoiceAwaitingAdminReview(inv: InvoiceRow): boolean {
  const hasReceipt = Boolean(String(inv.receipt_url ?? '').trim());
  if (!hasReceipt) return false;
  return inv.status === 'payment_review' || inv.status === 'pending';
}

type ClientQuoteContext = {
  clientId: string;
  clientName: string;
  phone: string;
  destinations: string[];
  travelDate: string | null;
  travelDays: number | null;
  travelersCount: number | null;
  flightSeat: string;
  foodAllergies: string;
  favoriteDrink: string;
  hotelPreference: string;
  dnaInterests: string[];
  dnaSpecialRequests: string;
  dnaActivityLevel: string;
  targetTrip: string;
  leadId: string | null;
};

const EMPTY_CLIENT_CONTEXT_ARRAYS = {
  destinations: [] as string[],
  dnaInterests: [] as string[],
};

function addDaysIsoSafe(isoDate: string, days: number): string {
  try {
    const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('en-CA');
    d.setDate(d.getDate() + Math.max(0, days));
    return d.toLocaleDateString('en-CA');
  } catch {
    return new Date().toLocaleDateString('en-CA');
  }
}

function joinDestinationsSafe(destinations: string[] | null | undefined): string {
  if (!Array.isArray(destinations) || !destinations.length) return '—';
  return destinations.map((d) => String(d ?? '').trim()).filter(Boolean).join(' · ') || '—';
}

function parseInterestList(raw: unknown): string[] {
  try {
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
    }
    const text = String(raw ?? '').trim();
    if (!text) return [];
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    return text
      .split(/[,،·|/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Inline DNA parse — never throws; avoids heavy lib imports in this client form. */
function safeParseTravelDna(raw: unknown): {
  preferred_seat: string;
  food_allergies: string;
  hotel_style: string;
  drink_coffee: string;
} {
  const empty = {
    preferred_seat: '',
    food_allergies: '',
    hotel_style: '',
    drink_coffee: '',
  };
  try {
    let o: Record<string, unknown> = {};
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return empty;
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        o = parsed as Record<string, unknown>;
      }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      o = raw as Record<string, unknown>;
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = o[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return '';
    };
    return {
      preferred_seat: pick('preferred_seat', 'flight_seat', 'seat', 'flight_preferences'),
      food_allergies: pick(
        'food_allergies',
        'food_preference',
        'food_preferences',
        'dietary',
        'dietary_restrictions',
      ),
      hotel_style: pick('hotel_style', 'hotel_preference', 'hotel_preferences', 'hotel_type'),
      drink_coffee: pick('drink_coffee', 'favorite_drink', 'drink', 'beverage', 'coffee'),
    };
  } catch {
    return empty;
  }
}

async function fetchClientRowSafe(
  selectedClientId: string,
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;

  const selects = [
    'id, name, phone_wa, target_trip, flight_seat, food_allergies, favorite_drink, hotel_preference, dna_interests, dna_special_requests, dna_activity_level, travel_dna, dietary',
    'id, name, phone_wa, target_trip, flight_seat, food_allergies, favorite_drink, hotel_preference, dna_interests, travel_dna',
    'id, name, phone_wa, target_trip, travel_dna',
    'id, name, phone_wa',
  ];

  for (const select of selects) {
    try {
      const res = await supabase
        .from('clients')
        .select(select)
        .eq('id', selectedClientId)
        .maybeSingle();
      if (!res.error && res.data) return res.data as Record<string, unknown>;
      if (res.error) {
        console.warn('[QuoteBuilder] client select fallback:', res.error.message);
        // try next narrower select on column/schema errors
        if (!/column|schema|does not exist|Could not find/i.test(res.error.message)) {
          // non-schema error — still try fallback once then stop
          continue;
        }
      }
    } catch (err) {
      console.warn('[QuoteBuilder] client select caught:', err);
    }
  }
  return null;
}

async function fetchOptionalDnaSurvey(
  selectedClientId: string,
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  try {
    const res = await supabase
      .from('dna_surveys')
      .select('*')
      .eq('client_id', selectedClientId)
      .limit(1);
    if (res.error) {
      // Table may not exist — soft fail
      console.warn('[QuoteBuilder] dna_surveys (optional):', res.error.message);
      return null;
    }
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
  } catch (err) {
    console.warn('[QuoteBuilder] dna_surveys caught:', err);
    return null;
  }
}

async function fetchLeadRowSafe(
  selectedClientId: string,
  preferredLeadId: string | undefined,
  phone: string,
): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const leadSelect =
    'id, full_name, destinations, travel_date, travel_days, travelers_count, interests, food_preferences, accommodation_type, created_at';
  const leadSelectWithClient = `${leadSelect}, client_id`;

  try {
    const leadIdPreferred = String(preferredLeadId ?? '').trim();
    if (leadIdPreferred) {
      try {
        const byId = await supabase
          .from('leads')
          .select(leadSelectWithClient)
          .eq('id', leadIdPreferred)
          .maybeSingle();
        if (!byId.error && byId.data) return byId.data as Record<string, unknown>;
      } catch (err) {
        console.warn('[QuoteBuilder] lead by id caught:', err);
      }
    }

    try {
      const byClient = await supabase
        .from('leads')
        .select(leadSelectWithClient)
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!byClient.error && Array.isArray(byClient.data) && byClient.data[0]) {
        return byClient.data[0] as Record<string, unknown>;
      }
      if (byClient.error) {
        console.warn('[QuoteBuilder] lead by client_id:', byClient.error.message);
      }
    } catch (err) {
      console.warn('[QuoteBuilder] lead by client_id caught:', err);
    }

    if (phone) {
      try {
        const byPhone = await supabase
          .from('leads')
          .select(leadSelect)
          .eq('phone_wa', phone)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!byPhone.error && Array.isArray(byPhone.data) && byPhone.data[0]) {
          return byPhone.data[0] as Record<string, unknown>;
        }
      } catch (err) {
        console.warn('[QuoteBuilder] lead by phone caught:', err);
      }
    }
  } catch (err) {
    console.warn('[QuoteBuilder] fetchLeadRowSafe caught:', err);
  }
  return null;
}

async function fetchClientQuoteContext(
  selectedClientId: string,
  preferredLeadId?: string,
): Promise<ClientQuoteContext | null> {
  try {
    if (!supabase || !selectedClientId) return null;

    const row = await fetchClientRowSafe(selectedClientId);
    if (!row) return null;

    const survey = await fetchOptionalDnaSurvey(selectedClientId);
    const dna = safeParseTravelDna(row.travel_dna ?? survey?.travel_dna ?? survey?.answers);

    const flightSeat =
      String(row.flight_seat ?? survey?.flight_seat ?? '').trim() || dna.preferred_seat || '';
    const foodAllergies =
      String(row.food_allergies ?? row.dietary ?? survey?.food_allergies ?? '').trim() ||
      dna.food_allergies ||
      '';
    const favoriteDrink =
      String(row.favorite_drink ?? survey?.favorite_drink ?? '').trim() || dna.drink_coffee || '';
    const hotelPreference =
      String(row.hotel_preference ?? survey?.hotel_preference ?? '').trim() ||
      dna.hotel_style ||
      '';
    const dnaInterests = [
      ...parseInterestList(row.dna_interests),
      ...parseInterestList(survey?.dna_interests ?? survey?.interests),
    ];
    const targetTrip = String(row.target_trip ?? '').trim();
    const phone = String(row.phone_wa ?? '').trim();

    const leadRow = await fetchLeadRowSafe(selectedClientId, preferredLeadId, phone);

    const leadDests = Array.isArray(leadRow?.destinations)
      ? (leadRow!.destinations as unknown[])
          .map((d) => String(d ?? '').trim())
          .filter(Boolean)
      : [];
    const targetDests = targetTrip
      ? targetTrip.split(/[·,،|/]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const destinations = leadDests.length ? leadDests : targetDests;

    const leadInterests = parseInterestList(leadRow?.interests);
    const mergedInterests = [...new Set([...dnaInterests, ...leadInterests])];

    const foodFromLead = Array.isArray(leadRow?.food_preferences)
      ? (leadRow!.food_preferences as unknown[])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' · ')
      : String(leadRow?.food_preferences ?? '').trim();
    const hotelFromLead = Array.isArray(leadRow?.accommodation_type)
      ? (leadRow!.accommodation_type as unknown[])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' · ')
      : String(leadRow?.accommodation_type ?? '').trim();

    const travelDaysRaw = Number(leadRow?.travel_days);
    const travelersRaw = Number(leadRow?.travelers_count);

    return {
      clientId: selectedClientId,
      clientName:
        String(row.name ?? leadRow?.full_name ?? '').trim() || `عميل #${selectedClientId}`,
      phone,
      destinations: destinations ?? EMPTY_CLIENT_CONTEXT_ARRAYS.destinations,
      travelDate: String(leadRow?.travel_date ?? '').trim().slice(0, 10) || null,
      travelDays: Number.isFinite(travelDaysRaw) && travelDaysRaw > 0 ? travelDaysRaw : null,
      travelersCount:
        Number.isFinite(travelersRaw) && travelersRaw > 0 ? travelersRaw : null,
      flightSeat,
      foodAllergies: foodAllergies || foodFromLead,
      favoriteDrink,
      hotelPreference: hotelPreference || hotelFromLead,
      dnaInterests: mergedInterests ?? EMPTY_CLIENT_CONTEXT_ARRAYS.dnaInterests,
      dnaSpecialRequests: String(
        row.dna_special_requests ?? survey?.dna_special_requests ?? '',
      ).trim(),
      dnaActivityLevel: String(
        row.dna_activity_level ?? survey?.dna_activity_level ?? '',
      ).trim(),
      targetTrip,
      leadId: leadRow?.id != null ? String(leadRow.id) : null,
    };
  } catch (err) {
    console.error('[QuoteBuilder] Safely caught client context fetch:', err);
    return null;
  }
}

type ClientOption = {
  id: string;
  name: string;
  phone_wa?: string | null;
};

type TeamMemberOption = {
  id: string;
  name: string;
  role: 'expert' | 'employee';
  source: 'expert' | 'employee' | 'profile';
};

function teamMemberRole(roleRaw: string, isAdmin?: boolean): 'expert' | 'employee' {
  if (isAdmin || isEmployeeAdminRole(roleRaw)) return 'employee';
  if (isEmployeeExpertRole(roleRaw)) return 'expert';
  const t = String(roleRaw ?? '').trim().toLowerCase();
  if (t === 'expert' || t.includes('expert') || t.includes('خبير')) return 'expert';
  return 'employee';
}

const expertSelectClass =
  'w-full rounded-xl border border-[#2D3F3A] bg-[#1A2421] px-4 py-3 text-white outline-none focus:border-[#D4AF37] disabled:opacity-60';

type QuoteBuilderFormProps = {
  editQuoteId: string;
  isEditMode: boolean;
  /** من /crm/quotations/new?from=lead — يُعبّأ الحقول من طلب DNA */
  prefillFromLead?: boolean;
  initialLeadId?: string;
  /** من /crm/quotations/new?clientId= — يُعبّأ العميل تلقائياً */
  initialClientId?: string;
  lockClientFromDna?: boolean;
  initialClientName?: string;
  initialTripTitle?: string;
  initialDestination?: string;
  initialStartDate?: string;
  initialEndDate?: string;
};

function parseDestinationPrefill(raw: string): string[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '—') return [];
  return trimmed
    .split(/\s·\s|,|،/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white p-3 text-sm font-semibold text-[#1A3B2A] outline-none transition-all placeholder:text-slate-400 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/50 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-gray-100 dark:placeholder:text-slate-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-900 dark:text-white';
const helperClass = 'mt-1.5 block text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400';
const requiredMarkClass = 'ms-1 text-rose-400';
const cardClass =
  'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-[0_10px_20px_rgba(0,0,0,0.05)] dark:border-[#2D3F3A] dark:bg-[#22302C] sm:p-5';
const cellInputClass =
  'w-full min-w-[4rem] border-0 bg-transparent px-2 py-2 text-xs font-bold text-[#1A3B2A] outline-none placeholder:text-slate-400 focus:bg-[#C5A059]/10 focus:ring-1 focus:ring-inset focus:ring-[#C5A059]/40 dark:text-gray-100 dark:placeholder:text-slate-500';
const thClass =
  'bg-[#1A3B2A]/5 px-2 py-4 text-start text-xs font-semibold text-[#1A3B2A] border-b border-gray-200 dark:bg-[#1A2421] dark:text-gray-100 dark:border-[#2D3F3A]';

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className={labelClass}>
      {children}
      {required ? <span className={requiredMarkClass}>*</span> : null}
    </span>
  );
}

function normalizeClientId(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  const s = String(raw).trim();
  if (s === 'null' || s === 'undefined') return '';
  return s;
}

function mapClientRow(row: Record<string, unknown>): ClientOption | null {
  const raw = row.id ?? row.client_id ?? row.uuid;
  const id = normalizeClientId(raw);
  if (!id) return null;
  return {
    id,
    name: String(row.name ?? '').trim(),
    phone_wa: row.phone_wa != null ? String(row.phone_wa).trim() || null : null,
  };
}

/** Safe string trim — never throws on null/undefined */
function safeTrim(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Mirror brochure hotel_options → legacy hotel_proposals column for older readers */
function hotelOptionsToProposals(options: QuotationHotelOption[]): QuotationHotelProposal[] {
  return (options ?? [])
    .filter(
      (h) =>
        safeTrim(h?.name) ||
        safeTrim(h?.city) ||
        safeTrim(h?.description) ||
        Number(h?.price) > 0,
    )
    .map((h) => ({
      id: h.id || createEmptyHotelOption().id,
      hotel_name: safeTrim(h.name),
      city: safeTrim(h.city),
      room_type: safeTrim(h.description),
      price: Number(h.price) || 0,
    }));
}

function hotelProposalsToOptions(proposals: QuotationHotelProposal[]): QuotationHotelOption[] {
  return (proposals ?? [])
    .filter(
      (h) =>
        safeTrim(h?.hotel_name) ||
        safeTrim(h?.city) ||
        safeTrim(h?.room_type) ||
        Number(h?.price) > 0,
    )
    .map((h) => ({
      id: h.id || createEmptyHotelOption().id,
      city: safeTrim(h.city),
      name: safeTrim(h.hotel_name),
      description: safeTrim(h.room_type),
      price: Number(h.price) || 0,
      is_selected_by_client: false,
    }));
}

function transportOptionsToProposals(
  options: QuotationTransportOption[],
): QuotationTransportProposal[] {
  return (options ?? [])
    .filter(
      (t) => safeTrim(t?.name) || safeTrim(t?.description) || Number(t?.price) > 0,
    )
    .map((t) => ({
      id: t.id || createEmptyTransportOption().id,
      description: safeTrim(t.description) || safeTrim(t.name),
      mode: safeTrim(t.name),
      price: Number(t.price) || 0,
    }));
}

function transportProposalsToOptions(
  proposals: QuotationTransportProposal[],
): QuotationTransportOption[] {
  return (proposals ?? [])
    .filter(
      (t) =>
        safeTrim(t?.description) || safeTrim(t?.mode) || Number(t?.price) > 0,
    )
    .map((t) => {
      const mode = safeTrim(t.mode);
      const description = safeTrim(t.description);
      return {
        id: t.id || createEmptyTransportOption().id,
        name: mode || description,
        description: mode && description && mode !== description ? description : '',
        price: Number(t.price) || 0,
        is_selected_by_client: false,
      };
    });
}

function activityOptionsToProposals(
  options: QuotationActivityOption[],
): QuotationActivityProposal[] {
  return (options ?? [])
    .filter(
      (a) => safeTrim(a?.name) || safeTrim(a?.description) || Number(a?.price) > 0,
    )
    .map((a) => ({
      id: a.id || createEmptyActivityOption().id,
      name: safeTrim(a.name),
      location: '',
      description: safeTrim(a.description),
      price: Number(a.price) || 0,
    }));
}

function activityProposalsToOptions(
  proposals: QuotationActivityProposal[],
): QuotationActivityOption[] {
  return (proposals ?? [])
    .filter(
      (a) => safeTrim(a?.name) || safeTrim(a?.description) || Number(a?.price) > 0,
    )
    .map((a) => ({
      id: a.id || createEmptyActivityOption().id,
      name: safeTrim(a.name),
      description: safeTrim(a.description),
      price: Number(a.price) || 0,
      is_selected_by_client: false,
    }));
}

function sanitizeHotelOptions(rows: QuotationHotelOption[]): QuotationHotelOption[] {
  return ensureProposalRows(
    (rows ?? []).map((h) => ({
      id: h?.id || createEmptyHotelOption().id,
      city: safeTrim(h?.city),
      name: safeTrim(h?.name),
      description: safeTrim(h?.description),
      price: Number(h?.price) || 0,
      is_selected_by_client: Boolean(h?.is_selected_by_client),
    })),
    createEmptyHotelOption,
  );
}

function sanitizeTransportOptions(
  rows: QuotationTransportOption[],
): QuotationTransportOption[] {
  return ensureProposalRows(
    (rows ?? []).map((t) => ({
      id: t?.id || createEmptyTransportOption().id,
      name: safeTrim(t?.name),
      description: safeTrim(t?.description),
      price: Number(t?.price) || 0,
      is_selected_by_client: Boolean(t?.is_selected_by_client),
    })),
    createEmptyTransportOption,
  );
}

function sanitizeActivityOptions(
  rows: QuotationActivityOption[],
): QuotationActivityOption[] {
  return ensureProposalRows(
    (rows ?? []).map((a) => ({
      id: a?.id || createEmptyActivityOption().id,
      name: safeTrim(a?.name),
      description: safeTrim(a?.description),
      price: Number(a?.price) || 0,
      is_selected_by_client: Boolean(a?.is_selected_by_client),
    })),
    createEmptyActivityOption,
  );
}

function sanitizeItineraryDays(rows: QuotationItineraryDay[]): QuotationItineraryDay[] {
  return ensureProposalRows(
    (rows ?? []).map((d, i) => ({
      id: safeTrim(d?.id) || createEmptyItineraryDay(i + 1).id,
      dayNumber: Math.max(1, Math.trunc(Number(d?.dayNumber) || i + 1)),
      date: safeTrim(d?.date).slice(0, 10),
      city: safeTrim(d?.city),
      title: safeTrim(d?.title),
      description: safeTrim(d?.description),
    })),
    () => createEmptyItineraryDay(1),
  );
}

function sanitizeCostBreakdown(rows: QuotationCostLine[]): QuotationCostLine[] {
  return ensureProposalRows(
    (rows ?? []).map((c) => ({
      id: c?.id || createEmptyCostLine().id,
      item_name: safeTrim(c?.item_name),
      price: Number(c?.price) || 0,
    })),
    createEmptyCostLine,
  );
}

function normalizeWhatsAppPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 9) return `966${digits.slice(1)}`;
  return digits;
}

export function clientProposalUrl(quoteId: string): string {
  const id = String(quoteId ?? '').trim();
  if (typeof window === 'undefined') return id ? `/proposal/${id}` : '';
  return id ? `${window.location.origin}/proposal/${id}` : '';
}

function PriceInput({
  value,
  onChange,
  className = cellInputClass,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      placeholder="0"
      className={`${className} text-end`}
      dir="ltr"
    />
  );
}

export function QuoteBuilderForm({
  editQuoteId,
  isEditMode,
  prefillFromLead = false,
  initialLeadId = '',
  initialClientId = '',
  lockClientFromDna = false,
  initialClientName = '',
  initialTripTitle = '',
  initialDestination = '',
  initialStartDate = '',
  initialEndDate = '',
}: QuoteBuilderFormProps) {
  const router = useRouter();
  const { profileAccess } = useCrmEmployee();
  const canEditItinerary = canEditItineraries(profileAccess);
  const readOnly = !canEditItinerary;

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingStatus, setEditingStatus] = useState<QuotationStatus>('pending_client');
  const [loadedStatus, setLoadedStatus] = useState<QuotationStatus>('pending_client');
  const [statusTouched, setStatusTouched] = useState(false);
  const [clientFeedback, setClientFeedback] = useState<QuotationClientFeedback>({});
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [quoteSavedToDb, setQuoteSavedToDb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewInvoices, setReviewInvoices] = useState<InvoiceRow[]>([]);

  const [clientId, setClientId] = useState('');
  const [clientContext, setClientContext] = useState<ClientQuoteContext | null>(null);
  const [loadingClientContext, setLoadingClientContext] = useState(false);
  const autofilledClientRef = useRef<string>('');
  const [expertId, setExpertId] = useState('');
  const [expertName, setExpertName] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState('');
  const [title, setTitle] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [marginPercent, setMarginPercent] = useState('20');
  const [serviceFee, setServiceFee] = useState('0');

  const [flights, setFlights] = useState<QuotationFlightProposal[]>([createEmptyFlightProposal()]);

  const [itineraryDays, setItineraryDays] = useState<QuotationItineraryDay[]>([
    createEmptyItineraryDay(1),
  ]);
  const [hotelOptions, setHotelOptions] = useState<QuotationHotelOption[]>([
    createEmptyHotelOption(),
  ]);
  const [transportOptions, setTransportOptions] = useState<QuotationTransportOption[]>([
    createEmptyTransportOption(),
  ]);
  const [activityOptions, setActivityOptions] = useState<QuotationActivityOption[]>([
    createEmptyActivityOption(),
  ]);
  const [costBreakdown, setCostBreakdown] = useState<QuotationCostLine[]>([
    createEmptyCostLine(),
  ]);
  const [savedPricings, setSavedPricings] = useState<SavedGroupPricingListItem[]>([]);
  const [importedPricingId, setImportedPricingId] = useState('');

  const [hotelPlaces, setHotelPlaces] = useState<QuotationHotelPlace[]>([]);
  const pendingClientId = useRef('');
  const lockedClientIdRef = useRef('');

  const baseCost = useMemo(
    () =>
      sumProposalPrices(flights, hotelOptions, activityOptions, transportOptions),
    [flights, hotelOptions, activityOptions, transportOptions],
  );

  const marginProfit = useMemo(
    () => calculateProfitFromMargin(baseCost, Number(marginPercent) || 0),
    [baseCost, marginPercent],
  );

  const grandTotal = useMemo(
    () => calculateQuotationGrandTotal(baseCost, Number(marginPercent) || 0, Number(serviceFee) || 0),
    [baseCost, marginPercent, serviceFee],
  );

  const persistedQuoteId = useMemo(
    () => quotationEditId({ id: editingId, lead_id: null }),
    [editingId],
  );

  const isQuoteSaved = useMemo(
    () => isQuoteSavedId(persistedQuoteId || editingId),
    [editingId, persistedQuoteId],
  );

  const loadReviewInvoices = useCallback(async () => {
    if (!persistedQuoteId || !isQuoteSaved) {
      setReviewInvoices([]);
      return;
    }
    const result = await listInvoicesForQuoteAction(persistedQuoteId);
    if (!result.ok) {
      setReviewInvoices([]);
      return;
    }
    setReviewInvoices(result.invoices.filter(isInvoiceAwaitingAdminReview));
  }, [isQuoteSaved, persistedQuoteId]);

  useEffect(() => {
    void loadReviewInvoices();
  }, [loadReviewInvoices, ledgerRefreshKey]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('group_pricings')
        .select(
          'id, title, final_selling_price_per_pax, total_group_revenue, passengers_count, created_at',
        )
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.warn('[QuoteBuilder] group_pricings fetch failed:', error.message);
        return;
      }
      if (data) setSavedPricings(data as SavedGroupPricingListItem[]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImportPricing = useCallback(async (pricingId: string) => {
    setImportedPricingId(pricingId);
    if (!pricingId) return;
    if (!supabase) {
      toast.error('تعذر الاتصال بقاعدة البيانات');
      return;
    }

    const { data, error } = await supabase
      .from('group_pricings')
      .select('*')
      .eq('id', pricingId)
      .maybeSingle();

    if (error || !data) {
      toast.error('تعذر استدراج تسعير القروب');
      return;
    }

    const row = data as GroupPricingRow;
    const pax = Math.max(1, Number(row.passengers_count) || 1);
    const nights = Math.max(1, Number(row.nights_count) || 7);
    const groupMarginPct =
      Number(row.profit_margin) || Number(row.effective_margin) || 20;
    const quoteMarginPct = groupMarginToQuoteCostPlusPercent(groupMarginPct);

    const direct = parseDirectCosts(row.direct_costs, nights);
    const fixed = parseFixedCosts(row.fixed_costs);
    const fromBreakdown = parseHotelsList(row.hotels_breakdown, nights);
    const hotels =
      fromBreakdown.length > 0 ? fromBreakdown : (direct.hotels ?? []).filter(
        (h) => h.unifiedBaseRoomRate > 0 || h.customVipServicesTotalCost > 0,
      );
    const hotelCalc = calculateHotelsGroupTotal(hotels, pax);

    const label = String(row.itinerary_name || row.title || 'تسعير قروب').trim();
    setTitle(label);
    setMarginPercent(String(quoteMarginPct));
    setServiceFee('0');

    if (hotelCalc.breakdowns.length > 0) {
      setHotelOptions(
        hotelCalc.breakdowns.map((b, i) => {
          const h = hotels[i] ?? hotels[0];
          return {
            ...createEmptyHotelOption(),
            name: h?.name || 'إقامة القروب',
            description: `${h?.nightsCount ?? nights} ليالٍ · سعر موحّد ${(h?.unifiedBaseRoomRate ?? 0).toLocaleString('ar-SA')} · ${pax} مسافر`,
            price: money2(b.hotelTotal),
            is_selected_by_client: true,
          };
        }),
      );
    } else if (direct.hotel > 0) {
      setHotelOptions([
        {
          ...createEmptyHotelOption(),
          name: 'إقامة القروب',
          description: `متوسط ${direct.hotel.toLocaleString('ar-SA')} ر.س/مسافر · ${pax} مسافر`,
          price: money2(direct.hotel * pax),
          is_selected_by_client: true,
        },
      ]);
    } else {
      setHotelOptions([createEmptyHotelOption()]);
    }

    setFlights([
      {
        ...createEmptyFlightProposal(),
        airline: 'طيران القروب (مستورد)',
        price: money2(direct.flight * pax),
      },
    ]);

    setActivityOptions([
      {
        ...createEmptyActivityOption(),
        name: 'أنشطة ووجبات القروب',
        description: `مستورد من تسعير قروب · ${pax} مسافر`,
        price: money2((direct.activities + direct.meals) * pax),
        is_selected_by_client: true,
      },
    ]);

    const fixedTotal = fixed.leader + fixed.expert + fixed.marketing + fixed.contingency;
    setTransportOptions([
      {
        ...createEmptyTransportOption(),
        name: 'تكاليف ثابتة للقروب',
        description:
          [
            fixed.leader > 0 ? `ليدر ${fixed.leader.toLocaleString('ar-SA')}` : '',
            fixed.expert > 0 ? `خبير ${fixed.expert.toLocaleString('ar-SA')}` : '',
            fixed.marketing > 0 ? `تسويق ${fixed.marketing.toLocaleString('ar-SA')}` : '',
            fixed.contingency > 0 ? `طوارئ ${fixed.contingency.toLocaleString('ar-SA')}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || `مستورد من تسعير قروب · ${pax} مسافر`,
        price: money2(fixedTotal),
        is_selected_by_client: true,
      },
    ]);

    const costLines: QuotationCostLine[] = [];
    const hotelGroupTotal = hotelCalc.hotelGroupTotal || direct.hotel * pax;
    if (hotelGroupTotal > 0) {
      costLines.push({
        ...createEmptyCostLine(),
        item_name: 'الفنادق (إجمالي القروب)',
        price: money2(hotelGroupTotal),
      });
    }
    if (direct.flight > 0) {
      costLines.push({
        ...createEmptyCostLine(),
        item_name: 'الطيران (إجمالي القروب)',
        price: money2(direct.flight * pax),
      });
    }
    if (direct.activities + direct.meals > 0) {
      costLines.push({
        ...createEmptyCostLine(),
        item_name: 'الأنشطة والوجبات (إجمالي القروب)',
        price: money2((direct.activities + direct.meals) * pax),
      });
    }
    if (fixedTotal > 0) {
      costLines.push({
        ...createEmptyCostLine(),
        item_name: 'التكاليف الثابتة (إجمالي القروب)',
        price: money2(fixedTotal),
      });
    }
    setCostBreakdown(costLines.length > 0 ? costLines : [createEmptyCostLine()]);

    const sellPerPax = Number(row.final_selling_price_per_pax) || 0;
    toast.success(
      sellPerPax > 0
        ? `تم استدراج «${label}» · ${pax} مسافر · سعر الفرد ${sellPerPax.toLocaleString('ar-SA')} ر.س`
        : `تم استدراج «${label}» · ${pax} مسافر`,
    );
  }, []);

  const handleReceiptApproved = useCallback(
    async (_invoice: InvoiceRow, quotationStatus: string) => {
      setSuccess('تم تأكيد ومطابقة الحوالة — ترحيل العميل والرحلة قيد التحديث.');
      if (
        quotationStatus === 'payment_confirmed' ||
        quotationStatus === 'deposit_paid' ||
        quotationStatus === 'fully_paid'
      ) {
        setEditingStatus(quotationStatus as QuotationStatus);
        setLoadedStatus(quotationStatus as QuotationStatus);
        setStatusTouched(true);
      }
      if (supabase && (initialLeadId || clientId)) {
        await updatePipelineStatus(
          supabase,
          {
            leadId: initialLeadId || null,
            clientId: clientId || null,
            force: true,
          },
          'payment_confirmed',
        ).catch(() => undefined);
      }
      setLedgerRefreshKey((k) => k + 1);
      await loadReviewInvoices();
    },
    [clientId, initialLeadId, loadReviewInvoices],
  );

  const handleReceiptRejected = useCallback(async () => {
    setLedgerRefreshKey((k) => k + 1);
    await loadReviewInvoices();
  }, [loadReviewInvoices]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clientId, clients],
  );

  const feedbackLabels = useMemo(
    () =>
      buildFeedbackLabelMaps({
        days: itineraryDays,
        hotels: hotelOptions,
        transports: transportOptions,
        activities: activityOptions,
      }),
    [activityOptions, hotelOptions, itineraryDays, transportOptions],
  );

  const showClientFeedbackAlert = useMemo(
    () => hasClientFeedback(clientFeedback),
    [clientFeedback],
  );

  const canIssueInvoice = useMemo(
    () =>
      isEditMode &&
      !loadingQuote &&
      isQuoteSaved &&
      isQuotationStatusApproved(editingStatus),
    [editingStatus, isEditMode, isQuoteSaved, loadingQuote],
  );

  const invoiceQuotationRow = useMemo((): QuotationRow | null => {
    if (!isQuoteSaved || !isQuotationStatusApproved(editingStatus) || !persistedQuoteId) return null;
    const client = clients.find((c) => c.id === clientId);
    return {
      id: persistedQuoteId,
      lead_id: null,
      client_id: clientId || null,
      title,
      destinations,
      start_date: startDate || null,
      end_date: endDate || null,
      total_estimated_cost: baseCost,
      expected_profit: marginProfit + (Number(serviceFee) || 0),
      status: editingStatus,
      paid_amount: 0,
      remaining_amount: grandTotal,
      trip_category: 'private',
      flight_proposals: flights,
      hotel_proposals: hotelOptionsToProposals(hotelOptions),
      activities_proposals: activityOptionsToProposals(activityOptions),
      transport_proposals: transportOptionsToProposals(transportOptions),
      profit_margin: Number(marginPercent) || 0,
      service_fee: Number(serviceFee) || 0,
      grand_total: grandTotal,
      lead_source: safeTrim(leadSource) || null,
      referral_code: null,
      is_referral_paid: false,
      expert_name: safeTrim(expertName) || null,
      expert_id: safeTrim(expertId) || null,
      created_at: '',
      itinerary_days: itineraryDays,
      hotel_options: hotelOptions,
      transport_options: transportOptions,
      activity_options: activityOptions,
      cost_breakdown: costBreakdown,
      client_feedback: {},
      clients: client ? { name: client.name, phone_wa: null } : null,
    };
  }, [
    activityOptions,
    baseCost,
    canIssueInvoice,
    clientId,
    clients,
    costBreakdown,
    destinations,
    editingStatus,
    endDate,
    expertId,
    expertName,
    flights,
    grandTotal,
    hotelOptions,
    itineraryDays,
    leadSource,
    marginPercent,
    marginProfit,
    persistedQuoteId,
    serviceFee,
    startDate,
    title,
    transportOptions,
  ]);

  const selectedTeamValue = useMemo(() => {
    if (expertId) {
      const byId = teamMembers.find((m) => String(m.id) === String(expertId));
      if (byId) return byId.id;
    }
    const name = safeTrim(expertName);
    if (!name) return '';
    const byName = teamMembers.find(
      (m) => m.name.trim().toLowerCase() === name.toLowerCase(),
    );
    return byName?.id ?? '';
  }, [expertId, expertName, teamMembers]);

  const loadClients = useCallback(async () => {
    if (!supabase) {
      setError('Supabase غير مهيأ.');
      setLoadingClients(false);
      return;
    }
    setLoadingClients(true);
    const primary = await supabase
      .from('clients')
      .select('id, name, phone_wa')
      .order('name', { ascending: true });

    let data: Record<string, unknown>[] | null = null;
    if (!primary.error) {
      data = (primary.data ?? []) as Record<string, unknown>[];
    } else {
      const fallback = await supabase.from('clients').select('*').order('name', { ascending: true });
      if (fallback.error) {
        setError(fallback.error.message || 'تعذر تحميل العملاء.');
        setClients([]);
        setLoadingClients(false);
        return;
      }
      data = (fallback.data ?? []) as Record<string, unknown>[];
    }

    const mapped = (data ?? [])
      .map((row) => mapClientRow(row))
      .filter((c): c is ClientOption => c != null);
    setClients(mapped);
    setLoadingClients(false);
  }, []);

  const loadTeamMembers = useCallback(async () => {
    setLoadingTeam(true);
    setTeamLoadError(null);
    const merged = new Map<string, TeamMemberOption>();

    const pushMember = (member: TeamMemberOption) => {
      const name = member.name.trim();
      const id = String(member.id ?? '').trim();
      if (!name || !id) return;
      // Prefer expert rows when the same person appears as employee too (match by name)
      if (member.source === 'expert') {
        for (const [existingId, existing] of merged) {
          if (
            existing.source !== 'expert' &&
            existing.name.trim().toLowerCase() === name.toLowerCase()
          ) {
            merged.delete(existingId);
          }
        }
      } else {
        for (const existing of merged.values()) {
          if (
            existing.source === 'expert' &&
            existing.name.trim().toLowerCase() === name.toLowerCase()
          ) {
            return;
          }
        }
      }
      // Prefer first id if collision across tables
      if (merged.has(id) && merged.get(id)!.source === 'expert' && member.source !== 'expert') {
        return;
      }
      merged.set(id, { ...member, id, name });
    };

    try {
      // 1) Experts directory (service-role API — same source as itinerary builder)
      try {
        const token = await getClientAccessToken();
        const res = await fetch('/api/crm/experts', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          rows?: Array<{ id?: string; name?: string }>;
          error?: string;
        };
        if (res.ok && payload.ok && Array.isArray(payload.rows)) {
          for (const row of payload.rows) {
            pushMember({
              id: String(row.id ?? '').trim(),
              name: String(row.name ?? '').trim(),
              role: 'expert',
              source: 'expert',
            });
          }
        }
      } catch (err) {
        console.warn('[QuoteBuilder] experts fetch:', err);
      }

      // 2) Employees / registered CRM staff
      if (supabase) {
        const emp = await supabase
          .from('employees')
          .select('id, full_name, role, is_admin, is_suspended')
          .order('full_name', { ascending: true });
        if (!emp.error && emp.data) {
          for (const row of emp.data as Array<Record<string, unknown>>) {
            if (row.is_suspended === true) continue;
            const name = String(row.full_name ?? '').trim();
            const roleRaw = String(row.role ?? '').trim();
            pushMember({
              id: String(row.id ?? '').trim(),
              name,
              role: teamMemberRole(roleRaw, Boolean(row.is_admin)),
              source: 'employee',
            });
          }
        } else if (emp.error && !/permission|rls|policy/i.test(emp.error.message)) {
          console.warn('[QuoteBuilder] employees fetch:', emp.error.message);
        }
      }

      // 3) Profiles fallback (auth CRM users)
      if (supabase && merged.size === 0) {
        const profiles = await supabase
          .from('profiles')
          .select('id, full_name, is_admin')
          .order('full_name', { ascending: true });
        if (!profiles.error && profiles.data) {
          for (const row of profiles.data as Array<Record<string, unknown>>) {
            pushMember({
              id: String(row.id ?? '').trim(),
              name: String(row.full_name ?? '').trim(),
              role: 'employee',
              source: 'profile',
            });
          }
        }
      }

      const list = [...merged.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'ar'),
      );
      setTeamMembers(list);
      if (!list.length) {
        setTeamLoadError('لم يُعثر على خبراء أو موظفين مسجّلين.');
      }
    } catch (err) {
      console.error('[QuoteBuilder] team members:', err);
      setTeamLoadError(err instanceof Error ? err.message : 'تعذر تحميل فريق العمل.');
      setTeamMembers([]);
    } finally {
      setLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
    void loadTeamMembers();
    void (async () => {
      try {
        setHotelPlaces(await fetchQuotationHotelPlaces());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'تعذر تحميل قاعدة الفنادق.');
      }
    })();
  }, [loadClients, loadTeamMembers]);

  useEffect(() => {
    if (isEditMode || !prefillFromLead) return;

    if (initialClientId) {
      const cid = normalizeClientId(initialClientId);
      if (cid) {
        lockedClientIdRef.current = cid;
        pendingClientId.current = cid;
        setClientId(cid);
      }
    }
    if (initialTripTitle) setTitle(initialTripTitle);
    const destParts = parseDestinationPrefill(initialDestination);
    if (destParts.length) setDestinations(destParts);
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
    setLeadSource((prev) => prev || 'trip_log');
  }, [
    initialClientId,
    initialDestination,
    initialEndDate,
    initialStartDate,
    initialTripTitle,
    isEditMode,
    prefillFromLead,
  ]);

  useEffect(() => {
    if (!lockClientFromDna || !initialClientId || loadingClients) return;
    const cid = normalizeClientId(initialClientId);
    if (!cid) return;
    if (clients.some((c) => c.id === cid)) return;
    setClients((prev) => [
      ...prev,
      { id: cid, name: safeTrim(initialClientName) || `عميل #${cid}` },
    ]);
  }, [clients, initialClientId, initialClientName, loadingClients, lockClientFromDna]);

  useEffect(() => {
    if (isEditMode || lockClientFromDna || !initialClientId) return;
    const cid = normalizeClientId(initialClientId);
    if (!cid) return;
    pendingClientId.current = cid;
    setClientId(cid);
  }, [initialClientId, isEditMode, lockClientFromDna]);

  const applyClientContextAutofill = useCallback(
    (ctx: ClientQuoteContext, opts?: { force?: boolean }) => {
      try {
        if (!ctx?.clientId) return;
        const force = Boolean(opts?.force);
        const already = autofilledClientRef.current === ctx.clientId;
        if (already && !force) return;
        autofilledClientRef.current = ctx.clientId;

        const destinations = Array.isArray(ctx.destinations) ? ctx.destinations : [];

        // Trip header only — NEVER inject DNA into itinerary / hotel / transfer / activity pricing rows
        if (destinations.length) {
          setDestinations((prev) =>
            Array.isArray(prev) && prev.length && !force ? prev : destinations,
          );
        }
        if (ctx.travelDate) {
          setStartDate((prev) => {
            if (prev && !force) return prev;
            return ctx.travelDate!;
          });
          setEndDate((prev) => {
            if (prev && !force) return prev;
            const days = Math.max(1, ctx.travelDays ?? 1);
            return addDaysIsoSafe(ctx.travelDate!, days - 1);
          });
        }
        setTitle((prev) => {
          if (String(prev ?? '').trim() && !force) return prev;
          const destLabel = destinations[0] || ctx.targetTrip || '';
          return destLabel
            ? `عرض سعر - ${ctx.clientName} · ${destLabel}`
            : `عرض سعر - ${ctx.clientName}`;
        });
      } catch (err) {
        console.error('[QuoteBuilder] Safely caught autofill error:', err);
      }
    },
    [],
  );

  useEffect(() => {
    const cid = normalizeClientId(clientId);
    if (!cid) {
      setClientContext(null);
      autofilledClientRef.current = '';
      return;
    }

    let cancelled = false;
    setLoadingClientContext(true);

    void (async () => {
      try {
        const ctx = await fetchClientQuoteContext(cid, initialLeadId);
        if (cancelled) return;
        setClientContext(ctx);
        if (ctx && !isEditMode && !loadingQuote) {
          try {
            applyClientContextAutofill(ctx);
          } catch (autofillErr) {
            console.error('[QuoteBuilder] autofill after fetch:', autofillErr);
          }
        }
      } catch (err) {
        console.error('[QuoteBuilder] Safely caught render/fetch error:', err);
        if (!cancelled) setClientContext(null);
      } finally {
        if (!cancelled) setLoadingClientContext(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyClientContextAutofill,
    clientId,
    initialLeadId,
    isEditMode,
    loadingQuote,
  ]);

  useEffect(() => {
    if (!editQuoteId) return;
    let cancelled = false;

    void (async () => {
      setLoadingQuote(true);
      setError('');
      try {
        const row = await fetchQuotationById(editQuoteId);
        if (cancelled) return;
        if (!row) {
          setError('تعذر العثور على عرض السعر للتعديل.');
          setQuoteSavedToDb(false);
          return;
        }

        setEditingId(normalizeQuotationId(row.id));
        setEditingStatus(row.status);
        setLoadedStatus(row.status);
        setStatusTouched(false);
        setQuoteSavedToDb(isQuotationPersisted({ id: row.id, lead_id: row.lead_id ?? null }));
        const cid = row.client_id != null ? String(row.client_id) : '';
        pendingClientId.current = cid;
        setClientId(cid);
        setLeadSource(safeTrim(row.lead_source));
        setExpertId(safeTrim(row.expert_id));
        setExpertName(safeTrim(row.expert_name));
        setTitle(safeTrim(row.title));
        setDestinations(
          (row.destinations ?? []).map((d) => safeTrim(d)).filter(Boolean),
        );
        setStartDate(safeTrim(row.start_date));
        setEndDate(safeTrim(row.end_date));
        setMarginPercent(String(row.profit_margin || 20));
        setServiceFee(String(row.service_fee || 0));
        setFlights(ensureProposalRows(row.flight_proposals, createEmptyFlightProposal));
        setItineraryDays(sanitizeItineraryDays(row.itinerary_days));
        {
          const fromOptions = sanitizeHotelOptions(row.hotel_options ?? []);
          const hasBrochureHotels = fromOptions.some(
            (h) =>
              safeTrim(h.name) ||
              safeTrim(h.city) ||
              safeTrim(h.description) ||
              h.price > 0,
          );
          setHotelOptions(
            hasBrochureHotels
              ? fromOptions
              : sanitizeHotelOptions(hotelProposalsToOptions(row.hotel_proposals ?? [])),
          );
        }
        {
          const fromOptions = sanitizeTransportOptions(row.transport_options ?? []);
          const hasBrochureTransport = fromOptions.some(
            (t) => safeTrim(t.name) || safeTrim(t.description) || t.price > 0,
          );
          setTransportOptions(
            hasBrochureTransport
              ? fromOptions
              : sanitizeTransportOptions(
                  transportProposalsToOptions(row.transport_proposals ?? []),
                ),
          );
        }
        {
          const fromOptions = sanitizeActivityOptions(row.activity_options ?? []);
          const hasBrochureActivities = fromOptions.some(
            (a) => safeTrim(a.name) || safeTrim(a.description) || a.price > 0,
          );
          setActivityOptions(
            hasBrochureActivities
              ? fromOptions
              : sanitizeActivityOptions(
                  activityProposalsToOptions(row.activities_proposals ?? []),
                ),
          );
        }
        setCostBreakdown(sanitizeCostBreakdown(row.cost_breakdown ?? []));
        setClientFeedback(row.client_feedback ?? emptyClientFeedback());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'تعذر تحميل عرض السعر.');
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editQuoteId]);

  useEffect(() => {
    const pending = pendingClientId.current;
    if (!pending || !clients.length) return;
    const match = clients.find((c) => c.id === pending);
    if (match) setClientId(match.id);
  }, [clients]);

  const addDestination = () => {
    const t = safeTrim(destinationInput);
    if (!t || destinations.some((d) => d.toLowerCase() === t.toLowerCase())) {
      setDestinationInput('');
      return;
    }
    setDestinations((prev) => [...prev, t]);
    setDestinationInput('');
  };

  const removeDestination = (index: number) => {
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFlight = (id: string, patch: Partial<QuotationFlightProposal>) => {
    setFlights((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = <T extends { id: string }>(
    rows: T[],
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: string,
    createEmpty: () => T,
  ) => {
    const next = rows.filter((r) => r.id !== id);
    setter(next.length > 0 ? next : [createEmpty()]);
  };

  const handleSave = async () => {
    if (readOnly) {
      setError('صلاحية القراءة فقط — لا يمكن تعديل أو حفظ عرض السعر.');
      toast.error('صلاحية القراءة فقط');
      return;
    }
    setError('');
    setSuccess('');

    const rawClientId = lockClientFromDna
      ? normalizeClientId(lockedClientIdRef.current || clientId)
      : normalizeClientId(clientId);

    let resolvedClientId: string | number;
    if (lockClientFromDna && rawClientId) {
      try {
        resolvedClientId = resolveQuotationClientId(rawClientId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'اختر عميلاً صالحاً.');
        return;
      }
    } else {
      const matchedClient = clients.find((c) => c.id === rawClientId);
      if (!rawClientId || !matchedClient) {
        setError('اختر عميلاً صالحاً.');
        return;
      }
      try {
        resolvedClientId = resolveQuotationClientId(matchedClient.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'اختر عميلاً صالحاً.');
        return;
      }
    }

    const titleSafe = safeTrim(title);
    const startSafe = safeTrim(startDate);
    const endSafe = safeTrim(endDate);
    if (!titleSafe) {
      setError('أدخل عنوان الرحلة.');
      return;
    }
    if (!destinations.length) {
      setError('أضف وجهة واحدة على الأقل.');
      return;
    }
    if (!startSafe || !endSafe) {
      setError('أدخل تاريخ البداية والنهاية.');
      return;
    }
    if (endSafe < startSafe) {
      setError('تاريخ النهاية يجب أن يكون بعد البداية.');
      return;
    }

    const hotelsSafe = sanitizeHotelOptions(hotelOptions);
    const transportsSafe = sanitizeTransportOptions(transportOptions);
    const activitiesSafe = sanitizeActivityOptions(activityOptions);
    const daysSafe = sanitizeItineraryDays(itineraryDays);
    const costsSafe = sanitizeCostBreakdown(costBreakdown);
    const flightsSafe = (flights ?? []).map((f) => ({
      ...f,
      id: f?.id || createEmptyFlightProposal().id,
      departureCity: safeTrim(f?.departureCity),
      arrivalCity: safeTrim(f?.arrivalCity),
      airline: safeTrim(f?.airline),
      flight_class: safeTrim(f?.flight_class),
      price: Number(f?.price) || 0,
    }));

    setSaving(true);
    try {
      for (const hotel of hotelsSafe) {
        if (
          hotel.name &&
          hotel.city &&
          !hotelExistsInQuotationPlaces(hotelPlaces, hotel.name, hotel.city)
        ) {
          const created = await silentInsertQuotationHotelPlace({
            hotelName: hotel.name,
            city: hotel.city,
            roomType: hotel.description,
          });
          if (created) {
            setHotelPlaces((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
          }
        }
      }

      const margin = Number(marginPercent) || 0;
      const fee = Number(serviceFee) || 0;
      const profitAmount = calculateProfitFromMargin(baseCost, margin);
      const total = calculateQuotationGrandTotal(baseCost, margin, fee);
      const activitiesSaved =
        serializeActivityProposalsForSave(
          activityOptionsToProposals(activitiesSafe),
        ) || [];
      const transportsSaved =
        serializeTransportProposalsForSave(
          transportOptionsToProposals(transportsSafe),
        ) || [];
      const itineraryDaysSaved = serializeItineraryDaysForSave(daysSafe);
      const hotelOptionsSaved = serializeHotelOptionsForSave(hotelsSafe);
      const transportOptionsSaved = serializeTransportOptionsForSave(transportsSafe);
      const activityOptionsSaved = serializeActivityOptionsForSave(activitiesSafe);
      const costBreakdownSaved = serializeCostBreakdownForSave(costsSafe);
      const hotelProposalsSaved =
        serializeHotelProposalsForSave(hotelOptionsToProposals(hotelsSafe)) || [];

      const inClientReview =
        Boolean(editingId) &&
        (isClientReviewStatus(loadedStatus) ||
          isClientReviewStatus(editingStatus) ||
          hasClientFeedback(clientFeedback));

      // Auto-reset to pending_client unless admin explicitly chose another status
      const nextStatus: QuotationStatus = !editingId
        ? 'pending_client'
        : statusTouched
          ? editingStatus
          : inClientReview
            ? 'pending_client'
            : editingStatus;

      const clearFeedback =
        nextStatus === 'pending_client' ||
        nextStatus === 'approved' ||
        nextStatus === 'draft' ||
        (!statusTouched && inClientReview);

      const payload = {
        client_id: resolvedClientId,
        title: titleSafe,
        destinations,
        start_date: startSafe,
        end_date: endSafe,
        flight_proposals: serializeFlightProposalsForSave(flightsSafe) || [],
        hotel_proposals: hotelProposalsSaved,
        activities: activitiesSaved,
        transportation: transportsSaved,
        itinerary_days: itineraryDaysSaved,
        hotel_options: hotelOptionsSaved,
        transport_options: transportOptionsSaved,
        activity_options: activityOptionsSaved,
        cost_breakdown: costBreakdownSaved,
        total_estimated_cost: baseCost,
        expected_profit: profitAmount,
        profit_margin: margin,
        service_fee: fee,
        grand_total: total,
        status: nextStatus,
        lead_source: safeTrim(leadSource) || null,
        expert_name: safeTrim(expertName) || null,
      expert_id: safeTrim(expertId) || null,
        updated_at: new Date().toISOString(),
        ...(clearFeedback ? { client_feedback: null } : {}),
      };

      if (!supabase) {
        setError('Supabase غير مهيأ.');
        return;
      }

      if (editingId) {
        let { data, error: updateError } = await supabase
          .from('quotations')
          .update(payload)
          .eq('id', editingId)
          .select('*');

        if (updateError?.message?.includes('column')) {
          // Keep brochure JSONB (esp. itinerary_days) — only drop activity_options if schema lagging
          const legacyPayload: Record<string, unknown> = {
            client_id: resolvedClientId,
            title: titleSafe,
            destinations,
            start_date: startSafe,
            end_date: endSafe,
            flight_proposals: payload.flight_proposals,
            hotel_proposals: payload.hotel_proposals,
            activities: activitiesSaved,
            transportation: transportsSaved,
            itinerary_days: itineraryDaysSaved,
            hotel_options: hotelOptionsSaved,
            transport_options: transportOptionsSaved,
            cost_breakdown: costBreakdownSaved,
            total_estimated_cost: baseCost,
            expected_profit: profitAmount + fee,
            status: nextStatus,
            lead_source: safeTrim(leadSource) || null,
            expert_name: safeTrim(expertName) || null,
      expert_id: safeTrim(expertId) || null,
            updated_at: new Date().toISOString(),
          };
          if (clearFeedback) {
            legacyPayload.client_feedback = null;
          }
          if (!/activity_options/i.test(updateError.message)) {
            legacyPayload.activity_options = activityOptionsSaved;
          }
          if (/client_feedback/i.test(updateError.message)) {
            if (clearFeedback) {
              legacyPayload.client_feedback = {};
            } else {
              delete legacyPayload.client_feedback;
            }
          }
          if (/expert_name/i.test(updateError.message)) {
            delete legacyPayload.expert_name;
          }
          if (/expert_id/i.test(updateError.message)) {
            delete legacyPayload.expert_id;
          }
          const retry = await supabase
            .from('quotations')
            .update(legacyPayload)
            .eq('id', editingId)
            .select('*');
          data = retry.data;
          updateError = retry.error;
        }

        if (updateError) {
          console.error('Supabase Update Error:', updateError);
          setError(`فشل التحديث: ${updateError.message}`);
          return;
        }

        // Force lifecycle via service_role so status cannot stay stuck on needs_revision
        const lifecycle = await setQuotationLifecycleAction(editingId, nextStatus, {
          clearFeedback,
        });
        if (!lifecycle.ok) {
          console.error('Lifecycle status force failed:', lifecycle.error);
          setError(
            `تم حفظ المحتوى لكن فشل تحديث الحالة: ${lifecycle.error}. جرّب تغيير «حالة العرض» يدوياً ثم الحفظ.`,
          );
          return;
        }

        if (data?.[0]?.id != null || lifecycle.ok) {
          setQuoteSavedToDb(true);
          setEditingStatus(lifecycle.row.status);
          setLoadedStatus(lifecycle.row.status);
          setStatusTouched(false);
          if (clearFeedback) {
            setClientFeedback(emptyClientFeedback());
          } else {
            setClientFeedback(lifecycle.row.client_feedback ?? emptyClientFeedback());
          }
          setSuccess(
            clearFeedback && nextStatus === 'pending_client'
              ? 'تم تحديث العرض وإعادته لبانتظار العميل — ملاحظات المراجعة أُغلقت. ✨'
              : 'تم تحديث عرض السعر بنجاح! ✨',
          );
          if (supabase && (initialLeadId || clientId)) {
            await updatePipelineStatus(
              supabase,
              {
                leadId: initialLeadId || null,
                clientId: clientId || null,
                force: true,
              },
              'quote_stage',
            ).catch(() => undefined);
          }
          if (supabase) {
            await cascadeQuotationDatesToItineraries(
              supabase,
              editingId,
              startSafe,
              endSafe,
            ).catch((err) => {
              console.error('[quote-save] itinerary date cascade:', err);
            });
          }
          router.push('/crm/quotations');
        }
        return;
      }

      let { data: insertedData, error: insertError } = await supabase
        .from('quotations')
        .insert([payload])
        .select('*');

      if (insertError?.message?.includes('column')) {
        const legacyPayload: Record<string, unknown> = {
          client_id: resolvedClientId,
          title: titleSafe,
          destinations,
          start_date: startSafe,
          end_date: endSafe,
          flight_proposals: payload.flight_proposals,
          hotel_proposals: payload.hotel_proposals,
          activities: activitiesSaved,
          transportation: transportsSaved,
          itinerary_days: itineraryDaysSaved,
          hotel_options: hotelOptionsSaved,
          transport_options: transportOptionsSaved,
          cost_breakdown: costBreakdownSaved,
          total_estimated_cost: baseCost,
          expected_profit: profitAmount + fee,
          status: 'pending_client' as const,
          lead_source: safeTrim(leadSource) || null,
          expert_name: safeTrim(expertName) || null,
      expert_id: safeTrim(expertId) || null,
          updated_at: new Date().toISOString(),
        };
        if (!/activity_options/i.test(insertError.message)) {
          legacyPayload.activity_options = activityOptionsSaved;
        }
        if (/expert_name/i.test(insertError.message)) {
          delete legacyPayload.expert_name;
        }
        if (/expert_id/i.test(insertError.message)) {
          delete legacyPayload.expert_id;
        }
        const retry = await supabase.from('quotations').insert([legacyPayload]).select('*');
        insertedData = retry.data;
        insertError = retry.error;
      }

      if (insertError) {
        console.error('Supabase Insert Error:', insertError);
        setError(`فشل الحفظ: ${insertError.message}`);
        return;
      }

      const newQuoteId = insertedData?.[0]?.id != null ? String(insertedData[0].id).trim() : '';
      if (newQuoteId) {
        if (supabase && (initialLeadId || clientId)) {
          await updatePipelineStatus(
            supabase,
            {
              leadId: initialLeadId || null,
              clientId: clientId || null,
              force: true,
            },
            'quote_stage',
          ).catch(() => undefined);
        }
        setSuccess('تم حفظ عرض السعر بنجاح! ✨');
        router.push(`/crm/quotations/edit/${encodeURIComponent(newQuoteId)}`);
      } else {
        setError('تم الحفظ، ولكن فشل استخراج معرّف العرض للتوجيه.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ عرض السعر.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 sm:pb-10">
      <Toaster position="top-center" />
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            {isEditMode ? 'تعديل عرض السعر' : 'إنشاء عرض سعر جديد'}
          </h1>
          <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm dark:text-slate-400">
            محرك تسعير ديناميكي — التكلفة تُحسب تلقائياً من أسعار الصفوف
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isQuoteSaved ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  const url = clientProposalUrl(persistedQuoteId);
                  if (!url) {
                    toast.error('احفظ العرض أولاً لنسخ رابط العميل.');
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success('تم نسخ الرابط! يمكنك الآن إرساله للعميل.');
                  } catch {
                    toast.error('تعذر نسخ الرابط — انسخه يدوياً.');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A84C]/50 bg-gradient-to-l from-[#FEFDF9] to-[#FFF8E7] px-3 py-2 text-xs font-black text-[#1C4532] shadow-sm transition hover:border-[#C9A84C] hover:bg-amber-50"
              >
                <Link2 size={14} aria-hidden />
                🔗 نسخ رابط العميل
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = clientProposalUrl(persistedQuoteId);
                  if (!url) {
                    toast.error('احفظ العرض أولاً لإرسال الرابط.');
                    return;
                  }
                  const message = `أهلاً بك، تم تجهيز عرض سعر رحلتك المخصص. يمكنك الاطلاع عليه واختيار تفضيلاتك عبر هذا الرابط الفاخر: ${url}`;
                  const phone = normalizeWhatsAppPhone(selectedClient?.phone_wa);
                  const waUrl = phone
                    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                    : `https://wa.me/?text=${encodeURIComponent(message)}`;
                  window.open(waUrl, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1ebe57]"
              >
                📱 إرسال عبر واتساب
              </button>
            </>
          ) : null}
          <Link
            href="/crm/quotations"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <X size={14} aria-hidden />
            رجوع للقائمة
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          {success}
        </div>
      ) : null}

      {readOnly ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          وضع القراءة فقط — يمكنك مشاهدة المسارات وعروض الأسعار دون تعديل أو حفظ.
        </div>
      ) : null}

      <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 disabled:opacity-90">
      {loadingQuote ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          جاري تحميل عرض السعر للتعديل…
        </div>
      ) : null}

      {showClientFeedbackAlert ? (
        <ClientFeedbackAlert
          feedback={clientFeedback}
          labels={feedbackLabels}
          className="mb-5"
        />
      ) : null}

      <ReceiptVerificationPanel
        invoices={reviewInvoices}
        onApproved={handleReceiptApproved}
        onRejected={handleReceiptRejected}
      />

      <section className={`${cardClass} mb-5 space-y-4`}>
        <h2 className="text-base font-black text-slate-900 dark:text-white">بيانات الرحلة</h2>

        <label className="block">
          <FieldLabel>حالة العرض</FieldLabel>
          <select
            value={editingStatus}
            onChange={(e) => {
              setEditingStatus(e.target.value as QuotationStatus);
              setStatusTouched(true);
            }}
            className={fieldClass}
            disabled={loadingQuote || saving}
          >
            {!ADMIN_STATUS_OPTIONS.some((o) => o.value === editingStatus) ? (
              <option value={editingStatus}>
                {QUOTATION_STATUS_LABEL[editingStatus] || editingStatus}
              </option>
            ) : null}
            {ADMIN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className={helperClass}>
            عند الحفظ من حالة «يحتاج تعديلاً» يُعاد العرض تلقائياً إلى «بانتظار العميل» وتُمسح ملاحظات
            العميل — إلا إذا اخترت حالة أخرى يدوياً من هذه القائمة.
          </p>
        </label>

        <label className="block">
          <FieldLabel required>العميل</FieldLabel>
          {lockClientFromDna && clientId ? (
            <input type="hidden" name="client_id" value={clientId} />
          ) : null}
          {loadingClients ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              جاري تحميل العملاء...
            </div>
          ) : lockClientFromDna ? (
            <>
              <select
                value={clientId}
                disabled
                aria-disabled="true"
                className={`${fieldClass} cursor-not-allowed bg-slate-50 opacity-90`}
              >
                {clientId ? (
                  <option value={clientId}>
                    {clients.find((c) => c.id === clientId)?.name ||
                      initialClientName ||
                      `عميل #${clientId}`}
                  </option>
                ) : (
                  <option value="">—</option>
                )}
              </select>
              <p className={helperClass}>
                العميل مرتبط بطلب DNA — لا يمكن تغييره لتجنب التكرار.
              </p>
            </>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={fieldClass}
              required
            >
              <option value="">— اختر العميل —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'بدون اسم'}
                </option>
              ))}
            </select>
          )}
        </label>

        {loadingClientContext ? (
          <div className="flex items-center gap-2 rounded-xl border border-[#2D3F3A]/60 bg-[#1A2421]/40 px-4 py-3 text-xs font-semibold text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            جاري جلب طلب العميل وتفضيلات DNA…
          </div>
        ) : null}

        {clientContext ? (
          <div className="rounded-xl border border-[#2D3F3A]/50 bg-[#22302C]/60 px-3 py-2 text-[11px] font-semibold text-slate-300">
            <span className="text-[#D4AF37]">طلب الرحلة:</span>{' '}
            {(clientContext.destinations ?? []).length
              ? joinDestinationsSafe(clientContext.destinations)
              : clientContext.targetTrip || '—'}
            {clientContext.travelDate ? ` · ${clientContext.travelDate}` : ''}
            {clientContext.travelDays ? ` · ${clientContext.travelDays} يوم` : ''}
            {clientContext.travelersCount != null
              ? ` · ${clientContext.travelersCount} مسافر`
              : ''}
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => {
                  try {
                    applyClientContextAutofill(clientContext, { force: true });
                  } catch (err) {
                    console.error('[QuoteBuilder] re-apply trip header:', err);
                  }
                }}
                className="mr-2 inline-flex rounded-md border border-[#D4AF37]/35 px-2 py-0.5 text-[10px] font-bold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                تعبئة الوجهات والتواريخ
              </button>
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <FieldLabel>اسم الخبير / الموظف</FieldLabel>
          {loadingTeam ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              جاري تحميل فريق العمل...
            </div>
          ) : (
            <select
              value={selectedTeamValue || expertId || expertName || ''}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId) {
                  setExpertId('');
                  setExpertName('');
                  return;
                }
                const matched = teamMembers?.find((m) => String(m.id) === String(nextId));
                setExpertId(nextId);
                setExpertName(matched?.name?.trim() || '');
              }}
              className={expertSelectClass}
              disabled={loadingQuote || saving}
            >
              <option value="">– اختر الخبير / الموظف –</option>
              {teamMembers?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}{' '}
                  {member.role
                    ? `(${member.role === 'expert' ? 'خبير' : 'موظف'})`
                    : ''}
                </option>
              ))}
            </select>
          )}
          <p
            className={`mt-1.5 text-[11px] font-bold leading-relaxed ${
              teamLoadError ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {teamLoadError
              ? teamLoadError
              : 'يُنقل تلقائياً إلى مركز قيادة المسارات عند التحويل من عرض السعر.'}
          </p>
        </label>

        <label className="block">
          <FieldLabel>مصدر العميل</FieldLabel>
          <select
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className={LEAD_SOURCE_SELECT_CLASS}
          >
            <option value="" disabled>
              اختر مصدر العميل...
            </option>
            {LEAD_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <FieldLabel required>عنوان الرحلة</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </label>

        <div>
          <FieldLabel required>الوجهات</FieldLabel>
          <div className="flex gap-2">
            <input
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDestination();
                }
              }}
              placeholder="Paris — Enter للإضافة"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addDestination}
              className="shrink-0 rounded-xl border border-[#C9A84C]/50 bg-[#FEFDF9] px-4 text-xs font-black text-[#1C4532] hover:bg-amber-50"
            >
              <Plus size={14} className="inline" aria-hidden /> إضافة
            </button>
          </div>
          {destinations.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {destinations.map((d, i) => (
                <li
                  key={`${d}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1C4532] px-3 py-1 text-xs font-bold text-[#C9A84C]"
                >
                  {d}
                  <button type="button" onClick={() => removeDestination(i)} aria-label={`حذف ${d}`}>
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel required>تاريخ البداية</FieldLabel>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${fieldClass} [color-scheme:light]`}
            />
          </label>
          <label className="block">
            <FieldLabel required>تاريخ النهاية</FieldLabel>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`${fieldClass} [color-scheme:light]`}
            />
          </label>
        </div>
      </section>

      <div className="mb-6 rounded-2xl border border-[#D4AF37]/40 bg-white p-5 shadow-sm">
        <label className="mb-2 flex items-center gap-2 text-base font-extrabold text-[#b8952d]">
          <span aria-hidden>🧮</span>
          <span>ربط بحساب تسعير قروب سابق (Group Pricing Import)</span>
        </label>
        <select
          value={importedPricingId}
          onChange={(e) => {
            void handleImportPricing(e.target.value);
          }}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-bold text-slate-800 outline-none transition focus:ring-2 focus:ring-[#D4AF37]"
        >
          <option value="">- اختر تسعير قروب مسبق لاستدراج البيانات تلقائياً -</option>
          {savedPricings.map((pricing) => (
            <option key={pricing.id} value={pricing.id}>
              {`${pricing.title || 'بدون عنوان'} | ${pricing.passengers_count ?? '—'} مسافر | سعر الفرد: ${Number(pricing.final_selling_price_per_pax || 0).toLocaleString('ar-SA')} ر.س`}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] font-medium text-slate-500">
          يستدرج التكلفة والهامش وبنود الفنادق/الطيران/الأنشطة والتكاليف الثابتة إلى المقترح المالي.
        </p>
      </div>

      <section className={`${cardClass} mb-5 space-y-4`}>
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
          💰 المقترح المالي
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <label className="block">
            <FieldLabel>التكلفة التقديرية (محسوبة)</FieldLabel>
            <input
              type="text"
              readOnly
              value={baseCost.toLocaleString('ar-SA')}
              className={`${fieldClass} cursor-not-allowed bg-slate-50 text-slate-700`}
              dir="ltr"
            />
          </label>
          <label className="block">
            <FieldLabel>نسبة الربح %</FieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              className={fieldClass}
            />
            {marginProfit > 0 ? (
              <p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-[#D4AF37]">
                هامش: {marginProfit.toLocaleString('ar-SA')} ر.س
              </p>
            ) : null}
          </label>
          <label className="block">
            <FieldLabel>رسوم خدمة Wanderloom</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.01"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="rounded-xl border border-[#C9A84C]/30 bg-[#1C4532] px-4 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]/80">
            الإجمالي للعميل
          </p>
          <p className="mt-1 text-2xl font-black text-[#C9A84C]" dir="ltr">
            {grandTotal.toLocaleString('ar-SA')} ر.س
          </p>
        </div>
      </section>

      {clientContext ? (
        <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-6 text-right shadow-sm">
          <h3 className="mb-4 text-base font-extrabold text-[#b8952d]">
            دليل الـ DNA للعميل (للاستدلال أثناء التسعير)
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-bold text-slate-800 md:grid-cols-4">
            <div>
              <span className="mb-0.5 block text-xs font-bold text-slate-500">أسلوب الإقامة:</span>
              <span className="font-bold text-slate-900">
                {clientContext.hotelPreference || 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="mb-0.5 block text-xs font-bold text-slate-500">المقعد المفضل:</span>
              <span className="font-bold text-slate-900">
                {clientContext.flightSeat || 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="mb-0.5 block text-xs font-bold text-slate-500">التفضيلات الغذائية:</span>
              <span className="font-bold text-slate-900">
                {clientContext.foodAllergies || 'لا يوجد'}
              </span>
            </div>
            <div>
              <span className="mb-0.5 block text-xs font-bold text-slate-500">الاهتمامات:</span>
              <span className="font-bold text-slate-900">
                {(clientContext.dnaInterests ?? []).length
                  ? (clientContext.dnaInterests ?? []).join(' ، ')
                  : 'عام'}
              </span>
            </div>
            {clientContext.favoriteDrink ? (
              <div>
                <span className="mb-0.5 block text-xs font-bold text-slate-500">المشروب:</span>
                <span className="font-bold text-slate-900">
                  {clientContext.favoriteDrink}
                </span>
              </div>
            ) : null}
            {clientContext.dnaActivityLevel ? (
              <div>
                <span className="mb-0.5 block text-xs font-bold text-slate-500">مستوى النشاط:</span>
                <span className="font-bold text-slate-900">
                  {clientContext.dnaActivityLevel}
                </span>
              </div>
            ) : null}
            {clientContext.dnaSpecialRequests ? (
              <div className="col-span-2 md:col-span-4">
                <span className="mb-0.5 block text-xs font-bold text-slate-500">طلبات خاصة:</span>
                <span className="font-bold text-slate-900">
                  {clientContext.dnaSpecialRequests}
                </span>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-[10px] font-medium text-slate-500">
            للقراءة فقط — لا تُحقَن في صفوف التسعير (المسار / الفنادق / النقل / الأنشطة).
          </p>
        </div>
      ) : null}

      <ProposalSection
        title="مقترحات الطيران"
        icon={<Plane size={18} className="text-[#C9A84C]" aria-hidden />}
        onAdd={() => setFlights((prev) => [...prev, createEmptyFlightProposal()])}
      >
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>من</th>
              <th className={thClass}>إلى</th>
              <th className={thClass}>الخطوط</th>
              <th className={thClass}>الدرجة</th>
              <th className={thClass}>السعر (ر.س)</th>
              <th className={`${thClass} w-10`} />
            </tr>
          </thead>
          <tbody>
            {flights.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {(['departureCity', 'arrivalCity', 'airline', 'flight_class'] as const).map((key) => (
                  <td key={key} className="border-l border-slate-100 p-0">
                    <input
                      value={row[key] ?? ''}
                      onChange={(e) => updateFlight(row.id, { [key]: e.target.value })}
                      className={cellInputClass}
                      dir="ltr"
                    />
                  </td>
                ))}
                <td className="border-l border-slate-100 p-0">
                  <PriceInput value={row.price} onChange={(v) => updateFlight(row.id, { price: v })} />
                </td>
                <td className="border-l border-slate-100 p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(flights, setFlights, row.id, createEmptyFlightProposal)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProposalSection>

      <InteractiveBrochureEditor
        itineraryDays={itineraryDays}
        setItineraryDays={setItineraryDays}
        hotelOptions={hotelOptions}
        setHotelOptions={setHotelOptions}
        transportOptions={transportOptions}
        setTransportOptions={setTransportOptions}
        activityOptions={activityOptions}
        setActivityOptions={setActivityOptions}
        costBreakdown={costBreakdown}
        setCostBreakdown={setCostBreakdown}
        destinations={destinations}
        hotelPlaces={hotelPlaces}
      />

      {isQuoteSaved ? (
        <>
          <QuoteFinancialSummaryCard
            quoteId={persistedQuoteId}
            liveTotalCost={grandTotal}
            refreshKey={ledgerRefreshKey}
          />
          {canIssueInvoice ? (
            <section className={`${cardClass} mb-5`}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <Receipt size={18} className="text-[#C9A84C]" aria-hidden />
                الفوترة
              </h2>
              <p className="mb-3 text-xs font-semibold text-slate-500">
                بعد اعتماد العميل — أصدر فاتورة عربون أو مبلغ كامل مرتبطة بهذا العرض المحفوظ.
              </p>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/50 bg-gradient-to-l from-[#FEFDF9] to-[#FFF8E7] px-4 py-2.5 text-xs font-black text-[#1C4532] shadow-sm transition hover:border-[#C9A84C] hover:bg-amber-50"
              >
                <Receipt size={14} aria-hidden />
                إصدار فاتورة
              </button>
            </section>
          ) : null}
          <QuoteInvoiceHistoryTable
            quoteId={persistedQuoteId}
            tripTitle={title}
            clientPhone={selectedClient?.phone_wa ?? null}
            refreshKey={ledgerRefreshKey}
          />
        </>
      ) : (
        <div className="mb-5 rounded-lg border border-amber-500 p-4 text-center text-sm font-bold text-amber-600">
          ⚠️ يجب حفظ عرض السعر بنجاح أولاً لتفعيل الفواتير.
        </div>
      )}

      <button
        type="button"
        disabled={saving || readOnly}
        onClick={() => void handleSave()}
        className="inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#8A6B2A] to-[#C9A84C] px-6 py-3 text-sm font-black text-[#1C4532] shadow-md disabled:opacity-60 sm:w-auto sm:py-4"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            جاري الحفظ...
          </>
        ) : readOnly ? (
          <>قراءة فقط — لا يمكن الحفظ</>
        ) : (
          <>
            <Save size={18} aria-hidden />
            {isEditMode ? 'تحديث عرض السعر' : 'حفظ عرض السعر'}
          </>
        )}
      </button>

      {invoiceModalOpen && invoiceQuotationRow ? (
        <GenerateInvoiceModal
          quotation={invoiceQuotationRow}
          onClose={() => setInvoiceModalOpen(false)}
          onCreated={() => {
            setLedgerRefreshKey((k) => k + 1);
            setEditingStatus('awaiting_payment');
            setInvoiceModalOpen(false);
            if (supabase && clientId) {
              void updatePipelineStatus(
                supabase,
                { clientId, force: true },
                'awaiting_payment',
              ).catch((err) => console.warn('[quote-builder] lead awaiting_payment:', err));
            }
          }}
        />
      ) : null}
      </fieldset>
    </div>
  );
}

function ProposalSection({
  title,
  icon,
  onAdd,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} mb-5`}>
      <div className="mb-3 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white sm:text-base">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-[#FEFDF9] px-3 py-1.5 text-[10px] font-black text-[#1C4532] hover:bg-amber-50"
        >
          <Plus size={12} aria-hidden />
          صف جديد
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">{children}</div>
    </section>
  );
}
