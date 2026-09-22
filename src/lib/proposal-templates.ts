/**
 * Proposal templates — save/load quotation structure for Quote Builder.
 * Table: public.proposal_templates (id, title, destination, content, created_at)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createEmptyActivityOption,
  createEmptyCostLine,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyTransportOption,
  parseActivityOptions,
  parseCostBreakdown,
  parseHotelOptions,
  parseItineraryDays,
  parseTransportOptions,
  serializeActivityOptionsForSave,
  serializeCostBreakdownForSave,
  serializeHotelOptionsForSave,
  serializeItineraryDaysForSave,
  serializeTransportOptionsForSave,
  type QuotationActivityOption,
  type QuotationCostLine,
  type QuotationHotelOption,
  type QuotationItineraryDay,
  type QuotationTransportOption,
} from '@/lib/interactive-quotation';
import {
  createEmptyFlightProposal,
  serializeFlightProposalsForSave,
  type QuotationFlightProposal,
} from '@/lib/crm-quotations';
import { addDaysIso } from '@/lib/dna-proposal-generator';

export const PROPOSAL_TEMPLATES_TABLE = 'proposal_templates' as const;

export type ProposalTemplateContent = {
  destinations: string[];
  itinerary_days: Record<string, unknown>[];
  hotel_options: Record<string, unknown>[];
  transport_options: Record<string, unknown>[];
  activity_options: Record<string, unknown>[];
  flight_proposals: Record<string, unknown>[];
  cost_breakdown: Record<string, unknown>[];
  margin_percent?: string;
  service_fee?: string;
  source_title?: string;
};

export type ProposalTemplateRow = {
  id: string;
  title: string;
  destination: string | null;
  content: ProposalTemplateContent;
  created_at: string;
};

export type ProposalTemplateSnapshot = {
  title: string;
  destinations: string[];
  itineraryDays: QuotationItineraryDay[];
  hotelOptions: QuotationHotelOption[];
  transportOptions: QuotationTransportOption[];
  activityOptions: QuotationActivityOption[];
  flights: QuotationFlightProposal[];
  costBreakdown: QuotationCostLine[];
  marginPercent?: string;
  serviceFee?: string;
};

export type AppliedProposalTemplate = {
  destinations: string[];
  itineraryDays: QuotationItineraryDay[];
  hotelOptions: QuotationHotelOption[];
  transportOptions: QuotationTransportOption[];
  activityOptions: QuotationActivityOption[];
  flights: QuotationFlightProposal[];
  costBreakdown: QuotationCostLine[];
  marginPercent: string;
  serviceFee: string;
  templateTitle: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseFlightProposalsLoose(raw: unknown): QuotationFlightProposal[] {
  if (!Array.isArray(raw)) return [createEmptyFlightProposal()];
  const mapped = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id ?? `flight-${index}`),
        departureCity: String(o.departureCity ?? o.departure_city ?? '').trim(),
        arrivalCity: String(o.arrivalCity ?? o.arrival_city ?? '').trim(),
        airline: String(o.airline ?? '').trim(),
        flight_class: String(o.flight_class ?? o.flightClass ?? '').trim(),
        price: Number(o.price) || 0,
      } satisfies QuotationFlightProposal;
    })
    .filter((x): x is QuotationFlightProposal => x != null);
  return mapped.length ? mapped : [createEmptyFlightProposal()];
}

function ensureOne<T>(rows: T[], factory: () => T): T[] {
  return rows.length ? rows : [factory()];
}

export function buildProposalTemplateContent(
  snapshot: ProposalTemplateSnapshot,
): ProposalTemplateContent {
  return {
    destinations: (snapshot.destinations ?? []).map((d) => String(d).trim()).filter(Boolean),
    itinerary_days: serializeItineraryDaysForSave(snapshot.itineraryDays ?? []),
    hotel_options: serializeHotelOptionsForSave(snapshot.hotelOptions ?? []),
    transport_options: serializeTransportOptionsForSave(snapshot.transportOptions ?? []),
    activity_options: serializeActivityOptionsForSave(snapshot.activityOptions ?? []),
    flight_proposals: serializeFlightProposalsForSave(snapshot.flights ?? []),
    cost_breakdown: serializeCostBreakdownForSave(snapshot.costBreakdown ?? []),
    margin_percent: snapshot.marginPercent,
    service_fee: snapshot.serviceFee,
    source_title: String(snapshot.title ?? '').trim() || undefined,
  };
}

/** Re-stamp itinerary day dates from a trip start date (keeps relative day order). */
function stampDaysFromStart(
  days: QuotationItineraryDay[],
  startDate: string,
): QuotationItineraryDay[] {
  const start = String(startDate ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return days;
  return days.map((day, idx) => ({
    ...day,
    dayNumber: day.dayNumber || idx + 1,
    date: addDaysIso(start, idx),
  }));
}

export function applyProposalTemplateContent(
  content: ProposalTemplateContent | Record<string, unknown> | null | undefined,
  opts?: { startDate?: string; templateTitle?: string },
): AppliedProposalTemplate {
  const root = asRecord(content);
  const destinations = Array.isArray(root.destinations)
    ? root.destinations.map((d) => String(d ?? '').trim()).filter(Boolean)
    : [];

  let itineraryDays = ensureOne(
    parseItineraryDays(root.itinerary_days),
    () => createEmptyItineraryDay(1),
  );
  if (opts?.startDate) {
    itineraryDays = stampDaysFromStart(itineraryDays, opts.startDate);
  }

  return {
    destinations,
    itineraryDays,
    hotelOptions: ensureOne(parseHotelOptions(root.hotel_options), createEmptyHotelOption),
    transportOptions: ensureOne(
      parseTransportOptions(root.transport_options),
      createEmptyTransportOption,
    ),
    activityOptions: ensureOne(
      parseActivityOptions(root.activity_options),
      createEmptyActivityOption,
    ),
    flights: parseFlightProposalsLoose(root.flight_proposals),
    costBreakdown: ensureOne(parseCostBreakdown(root.cost_breakdown), createEmptyCostLine),
    marginPercent: String(root.margin_percent ?? '20').trim() || '20',
    serviceFee: String(root.service_fee ?? '0').trim() || '0',
    templateTitle: String(opts?.templateTitle ?? '').trim(),
  };
}

function mapTemplateRow(row: Record<string, unknown>): ProposalTemplateRow | null {
  const id = String(row.id ?? '').trim();
  const title = String(row.title ?? '').trim();
  if (!id || !title) return null;
  const contentRaw = row.content;
  const content =
    contentRaw && typeof contentRaw === 'object' && !Array.isArray(contentRaw)
      ? (contentRaw as ProposalTemplateContent)
      : ({
          destinations: [],
          itinerary_days: [],
          hotel_options: [],
          transport_options: [],
          activity_options: [],
          flight_proposals: [],
          cost_breakdown: [],
        } satisfies ProposalTemplateContent);

  return {
    id,
    title,
    destination: row.destination != null ? String(row.destination).trim() || null : null,
    content,
    created_at: String(row.created_at ?? ''),
  };
}

export async function fetchProposalTemplates(
  client: SupabaseClient | null,
): Promise<ProposalTemplateRow[]> {
  if (!client) return [];
  const { data, error } = await client
    .from(PROPOSAL_TEMPLATES_TABLE)
    .select('id, title, destination, content, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'تعذر تحميل قوالب العروض.');
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map(mapTemplateRow)
    .filter((r): r is ProposalTemplateRow => r != null);
}

export async function saveProposalTemplate(
  client: SupabaseClient | null,
  input: {
    title: string;
    destination?: string | null;
    snapshot: ProposalTemplateSnapshot;
  },
): Promise<ProposalTemplateRow> {
  if (!client) throw new Error('Supabase غير مهيأ.');
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('أدخل اسم القالب.');

  const destinations = input.snapshot.destinations.filter(Boolean);
  const destination =
    String(input.destination ?? '').trim() ||
    (destinations.length ? destinations.join(' · ') : null);

  const content = buildProposalTemplateContent(input.snapshot);
  const payload = {
    title,
    destination,
    content,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from(PROPOSAL_TEMPLATES_TABLE)
    .insert(payload)
    .select('id, title, destination, content, created_at')
    .single();

  if (error || !data) {
    if (/does not exist|schema cache|relation/i.test(error?.message ?? '')) {
      throw new Error(
        'جدول proposal_templates غير موجود — نفّذ supabase/sql/proposal_templates.sql في Supabase.',
      );
    }
    throw new Error(error?.message || 'تعذر حفظ القالب.');
  }

  const mapped = mapTemplateRow(data as Record<string, unknown>);
  if (!mapped) throw new Error('تعذر قراءة القالب بعد الحفظ.');
  return mapped;
}
