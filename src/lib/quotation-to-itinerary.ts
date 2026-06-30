import { buildDatesFieldFromParts, stripItineraryPayloadForSchemaError } from '@/lib/itinerary-builder-model';
import {
  formatDestinationsLabel,
  isQuotationStatusApproved,
  normalizeQuotationId,
  quotationClientName,
  resolveQuotationClientId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { serializeQuotationDetails } from '@/lib/quotation-details';
import { supabase } from '@/lib/supabase';

export type CreateItineraryFromQuotationResult = {
  itineraryId: string | number;
  passcode: string;
};

export function generateVipPasscode(): string {
  return `VIP-${Math.floor(1000 + Math.random() * 9000)}`;
}

function resolveClientIdForItinerary(clientId: string | null): string | number | null {
  if (!clientId) return null;
  try {
    return resolveQuotationClientId(clientId);
  } catch {
    return clientId;
  }
}

function buildDestinationLabel(quotation: QuotationRow): string {
  const label = formatDestinationsLabel(quotation.destinations);
  if (label !== '—') return label;
  return quotation.title.trim() || 'رحلة VIP';
}

function buildFlightDetails(quotation: QuotationRow): Record<string, unknown>[] {
  return quotation.flight_proposals
    .filter((f) => f.departureCity || f.arrivalCity || f.airline || f.flight_class)
    .map((f) => ({
      departure_city: f.departureCity,
      arrival_city: f.arrivalCity,
      airline: f.airline,
      flight_class: f.flight_class,
    }));
}

function buildHotelDetails(quotation: QuotationRow): Record<string, unknown>[] {
  return quotation.hotel_proposals
    .filter((h) => h.hotel_name || h.city || h.room_type)
    .map((h) => ({
      name: h.hotel_name,
      city: h.city,
      room_type: h.room_type,
    }));
}

function stripQuotationItineraryPayload(
  errMsg: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  let next = stripItineraryPayloadForSchemaError(errMsg, payload);
  const lower = errMsg.toLowerCase();
  for (const key of [
    'passcode',
    'start_date',
    'end_date',
    'expected_profit',
    'total_estimated_cost',
    'quotation_details',
    'is_quotation',
    'flight_details',
    'hotel_details',
    'destination',
    'dates',
  ]) {
    if (lower.includes(key)) {
      next = { ...next };
      delete next[key];
    }
  }
  return next;
}

async function findExistingItineraryForQuotation(
  quotation: QuotationRow,
): Promise<{ id: string; passcode: string | null } | null> {
  if (!supabase) return null;

  const quoteId = normalizeQuotationId(quotation.id);
  if (!quoteId) return null;

  const { data: byMeta, error: metaErr } = await supabase
    .from('itineraries')
    .select('id, passcode')
    .filter('days_data->meta->>source_quotation_id', 'eq', quoteId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!metaErr && byMeta?.id != null) {
    return {
      id: String(byMeta.id),
      passcode: byMeta.passcode != null ? String(byMeta.passcode) : null,
    };
  }

  const clientId = resolveClientIdForItinerary(quotation.client_id);
  const title = quotation.title.trim() || buildDestinationLabel(quotation);
  if (clientId == null || !title) return null;

  const { data: byClientTitle, error: titleErr } = await supabase
    .from('itineraries')
    .select('id, passcode')
    .eq('client_id', clientId)
    .eq('title', title)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!titleErr && byClientTitle?.id != null) {
    return {
      id: String(byClientTitle.id),
      passcode: byClientTitle.passcode != null ? String(byClientTitle.passcode) : null,
    };
  }

  return null;
}

async function reactivateExistingItinerary(
  itineraryId: string,
  quotation: QuotationRow,
): Promise<CreateItineraryFromQuotationResult | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('itineraries')
    .update({
      status: 'active',
      expected_profit: quotation.expected_profit,
      total_estimated_cost: quotation.total_estimated_cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itineraryId)
    .select('id, passcode')
    .maybeSingle();

  if (error || data?.id == null) {
    console.error('Failed to reactivate existing itinerary:', error);
    return null;
  }

  return {
    itineraryId: data.id as string | number,
    passcode: String(data.passcode ?? generateVipPasscode()),
  };
}

/** يُنشئ مساراً في itineraries بعد اعتماد العميل لعرض السعر */
export async function createItineraryFromApprovedQuotation(
  quotation: QuotationRow,
): Promise<CreateItineraryFromQuotationResult | null> {
  if (!supabase) {
    console.error('Failed to auto-create itinerary: Supabase not configured');
    return null;
  }

  const existing = await findExistingItineraryForQuotation(quotation);
  if (existing) {
    const reactivated = await reactivateExistingItinerary(existing.id, quotation);
    if (reactivated) return reactivated;
    return {
      itineraryId: existing.id,
      passcode: existing.passcode ?? generateVipPasscode(),
    };
  }

  const startDate = quotation.start_date?.trim() ?? '';
  const endDate = (quotation.end_date?.trim() || startDate).trim();
  const destination = buildDestinationLabel(quotation);
  const passcode = generateVipPasscode();
  const customerName = quotationClientName(quotation);
  const flightDetails = buildFlightDetails(quotation);
  const hotelDetails = buildHotelDetails(quotation);

  const payload: Record<string, unknown> = {
    title: quotation.title.trim() || destination,
    destination,
    customer_name: customerName !== '—' ? customerName : 'عميل VIP',
    status: 'active',
    passcode,
    days_data: {
      days: [],
      meta: { source_quotation_id: quotation.id },
    },
    expected_profit: quotation.expected_profit,
    total_estimated_cost: quotation.total_estimated_cost,
    quotation_details: serializeQuotationDetails({
      enabled: true,
      hotelsEstimate: String(quotation.total_estimated_cost || ''),
      flightsEstimate: '',
      serviceFee: String(quotation.expected_profit || ''),
    }),
    is_quotation: false,
  };

  const clientId = resolveClientIdForItinerary(quotation.client_id);
  if (clientId != null) payload.client_id = clientId;

  if (startDate) {
    payload.start_date = startDate;
    payload.end_date = endDate || startDate;
    payload.dates = buildDatesFieldFromParts(startDate, endDate || startDate);
  }

  if (flightDetails.length) payload.flight_details = flightDetails;
  if (hotelDetails.length) payload.hotel_details = hotelDetails;

  let insertRes = await supabase.from('itineraries').insert(payload).select('id, passcode').single();

  if (insertRes.error && /column|schema cache|does not exist/i.test(insertRes.error.message ?? '')) {
    insertRes = await supabase
      .from('itineraries')
      .insert(stripQuotationItineraryPayload(insertRes.error.message ?? '', payload))
      .select('id, passcode')
      .single();
  }

  if (insertRes.error || insertRes.data?.id == null) {
    console.error('Failed to auto-create itinerary:', insertRes.error);
    return null;
  }

  return {
    itineraryId: insertRes.data.id as string | number,
    passcode: String(insertRes.data.passcode ?? passcode),
  };
}

export type RevertQuotationApprovalResult = {
  quotationId: string;
  itinerariesCleaned: number;
  itineraryWarnings: string[];
};

function extractSourceQuotationId(daysData: unknown): string | null {
  if (!daysData || typeof daysData !== 'object') return null;
  const meta = (daysData as Record<string, unknown>).meta;
  if (!meta || typeof meta !== 'object') return null;
  const id = (meta as Record<string, unknown>).source_quotation_id;
  return id != null ? String(id).trim() : null;
}

async function findItinerariesLinkedToQuotation(quotation: QuotationRow): Promise<string[]> {
  if (!supabase) return [];

  const quoteId = normalizeQuotationId(quotation.id);
  if (!quoteId) return [];

  const ids = new Set<string>();

  const { data: byMeta, error: metaErr } = await supabase
    .from('itineraries')
    .select('id')
    .filter('days_data->meta->>source_quotation_id', 'eq', quoteId);

  if (!metaErr && byMeta?.length) {
    for (const row of byMeta) {
      if (row.id != null) ids.add(String(row.id));
    }
  }

  const clientId = resolveClientIdForItinerary(quotation.client_id);
  const title = quotation.title.trim();
  const startDate = quotation.start_date?.slice(0, 10) ?? '';

  if (clientId != null && title) {
    const { data: byTitle, error: titleErr } = await supabase
      .from('itineraries')
      .select('id, days_data, title, start_date, status')
      .eq('client_id', clientId)
      .eq('title', title);

    if (!titleErr && byTitle?.length) {
      for (const row of byTitle) {
        const linkedId = extractSourceQuotationId(row.days_data);
        if (linkedId === quoteId) {
          ids.add(String(row.id));
          continue;
        }
        const rowStart = row.start_date != null ? String(row.start_date).slice(0, 10) : '';
        if (!startDate || rowStart === startDate) {
          ids.add(String(row.id));
        }
      }
    }
  }

  return [...ids];
}

async function archiveOrDeleteItinerary(itineraryId: string): Promise<'deleted' | 'archived' | 'failed'> {
  if (!supabase) return 'failed';

  const del = await supabase.from('itineraries').delete().eq('id', itineraryId);
  if (!del.error) return 'deleted';

  const archive = await supabase
    .from('itineraries')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', itineraryId);

  if (!archive.error) return 'archived';

  console.error('Itinerary cleanup failed:', itineraryId, del.error, archive.error);
  return 'failed';
}

/** يعيد العرض لـ pending_client وينظّف المسار المُنشأ تلقائياً */
export async function revertApprovedQuotation(
  quotation: QuotationRow,
): Promise<RevertQuotationApprovalResult> {
  if (!supabase) throw new Error('Supabase غير مهيأ.');

  const quoteId = normalizeQuotationId(quotation.id);
  if (!quoteId) throw new Error('معرّف العرض غير صالح.');

  const { data: updatedRows, error } = await supabase
    .from('quotations')
    .update({ status: 'pending_client', updated_at: new Date().toISOString() })
    .eq('id', quoteId)
    .select('id, status');

  if (error) throw new Error(error.message || 'فشل إلغاء الاعتماد في العرض.');

  const data = updatedRows?.[0];
  if (!data || isQuotationStatusApproved(data.status)) {
    throw new Error('لم يُحدَّث وضع العرض — تحقق من الصلاحيات.');
  }

  const itineraryIds = await findItinerariesLinkedToQuotation(quotation);
  const itineraryWarnings: string[] = [];
  let itinerariesCleaned = 0;

  for (const itineraryId of itineraryIds) {
    const outcome = await archiveOrDeleteItinerary(itineraryId);
    if (outcome === 'failed') {
      itineraryWarnings.push(`تعذر تنظيف المسار #${itineraryId}`);
    } else {
      itinerariesCleaned += 1;
    }
  }

  return { quotationId: quoteId, itinerariesCleaned, itineraryWarnings };
}
