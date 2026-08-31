import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildDatesFieldFromParts,
  stripItineraryPayloadForSchemaError,
  withItineraryExpertMeta,
} from '@/lib/itinerary-builder-model';
import {
  formatDestinationsLabel,
  isQuotationStatusApproved,
  mapQuotationRow,
  normalizeQuotationId,
  quotationClientName,
  resolveQuotationClientId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import { inferGeographyFromLabel } from '@/lib/itinerary-geography';
import { serializeQuotationDetails } from '@/lib/quotation-details';
import { supabase } from '@/lib/supabase';

export type CreateItineraryFromQuotationResult = {
  itineraryId: string | number;
  passcode: string;
};

export function generateVipPasscode(): string {
  return `VIP-${Math.floor(1000 + Math.random() * 9000)}`;
}

function resolveClientIdForItinerary(
  clientId: string | number | null | undefined,
): string | number | null {
  if (clientId == null || String(clientId).trim() === '') return null;
  try {
    return resolveQuotationClientId(clientId);
  } catch {
    const s = String(clientId).trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (Number.isSafeInteger(n) && n > 0) return n;
    }
    return s || null;
  }
}

function buildDestinationLabel(quotation: QuotationRow): string {
  const label = formatDestinationsLabel(quotation.destinations);
  if (label !== '—') return label;
  return quotation.title.trim() || 'رحلة VIP';
}

function quotationCities(quotation: QuotationRow): string[] {
  const fromDest = (quotation.destinations ?? [])
    .map((d) => String(d ?? '').trim())
    .filter(Boolean);
  if (fromDest.length) return [...new Set(fromDest)];
  const inferred = inferGeographyFromLabel(buildDestinationLabel(quotation));
  return inferred.cities;
}

function quotationCountries(quotation: QuotationRow): string[] {
  const cities = quotationCities(quotation);
  const inferred = inferGeographyFromLabel(
    cities.join(' · ') || buildDestinationLabel(quotation),
  );
  return inferred.countries;
}

async function resolveExpertIdByName(
  sb: SupabaseClient,
  expertName: string | null | undefined,
): Promise<string | null> {
  const name = String(expertName ?? '').trim();
  if (!name) return null;

  const { data, error } = await sb
    .from('experts')
    .select('id, name')
    .ilike('name', `%${name}%`)
    .limit(20);

  if (error || !data?.length) return null;

  const norm = name.toLowerCase().replace(/\s+/g, ' ');
  const exact = data.find(
    (row) =>
      String((row as { name?: unknown }).name ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ') === norm,
  );
  const hit = exact ?? data[0];
  const id = String((hit as { id?: unknown }).id ?? '').trim();
  return id || null;
}

async function resolveExpertIdForQuotation(
  sb: SupabaseClient,
  quotation: QuotationRow,
): Promise<string | null> {
  const fromQuote = String(quotation.expert_id ?? '').trim();
  if (fromQuote) return fromQuote;
  return resolveExpertIdByName(sb, quotation.expert_name);
}

/** ملخص Travel DNA من ملف العميل — يُرفق مع المسار النشط */
async function fetchClientDnaSummaryNotes(
  sb: SupabaseClient,
  clientId: string | number | null,
): Promise<string | null> {
  if (clientId == null || String(clientId).trim() === '') return null;

  const { data, error } = await sb
    .from('clients')
    .select(
      'dna_special_requests, dna_interests, dna_activity_level, hotel_preference, food_allergies, favorite_drink, flight_seat, dietary, travel_dna',
    )
    .eq('id', clientId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const parts: string[] = [];

  const interests = String(row.dna_interests ?? '').trim();
  if (interests) parts.push(`اهتمامات: ${interests}`);

  const activity = String(row.dna_activity_level ?? '').trim();
  if (activity) parts.push(`مستوى النشاط: ${activity}`);

  const special = String(row.dna_special_requests ?? '').trim();
  if (special) parts.push(`طلبات خاصة: ${special}`);

  const hotel = String(row.hotel_preference ?? '').trim();
  if (hotel) parts.push(`تفضيل فندق: ${hotel}`);

  const allergies = String(row.food_allergies ?? '').trim();
  if (allergies) parts.push(`حساسية غذائية: ${allergies}`);

  const dietary = String(row.dietary ?? '').trim();
  if (dietary) parts.push(`نظام غذائي: ${dietary}`);

  const drink = String(row.favorite_drink ?? '').trim();
  if (drink) parts.push(`مشروب مفضل: ${drink}`);

  const seat = String(row.flight_seat ?? '').trim();
  if (seat) parts.push(`مقعد طيران: ${seat}`);

  const travelDna = row.travel_dna;
  if (travelDna && typeof travelDna === 'object' && !Array.isArray(travelDna)) {
    const dna = travelDna as Record<string, unknown>;
    for (const [key, value] of Object.entries(dna)) {
      const v = String(value ?? '').trim();
      if (!v || v === 'null' || v === 'undefined') continue;
      if (parts.some((p) => p.includes(v))) continue;
      parts.push(`${key}: ${v}`);
    }
  }

  if (!parts.length) return null;
  return `ملخص Travel DNA\n${parts.slice(0, 12).join('\n')}`;
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

function buildFlightProposalsArray(quotation: QuotationRow): Record<string, unknown>[] {
  return quotation.flight_proposals
    .filter((f) => f.departureCity || f.arrivalCity || f.airline || f.flight_class)
    .map((f) => ({
      departure_city: f.departureCity,
      arrival_city: f.arrivalCity,
      airline: f.airline,
      flight_class: f.flight_class,
    }));
}

/**
 * Payload the Itinerary Builder dropdowns actually read:
 * - client_id (relational)
 * - expert_id + expert_name (relational + display)
 * - flight_details.cities / countries (geography UI)
 * - quote_id, dates, title, customer_name
 */
async function buildMappedItineraryPayload(
  sb: SupabaseClient,
  quotation: QuotationRow,
  opts?: { status?: 'draft' | 'active'; passcode?: string },
): Promise<Record<string, unknown>> {
  const clientName = quotationClientName(quotation);
  const destination = buildDestinationLabel(quotation);
  const cities = quotationCities(quotation);
  const countries = quotationCountries(quotation);
  const startDate = quotation.start_date?.trim() ?? '';
  const endDate = (quotation.end_date?.trim() || startDate).trim();
  const passcode = opts?.passcode ?? generateVipPasscode();
  const expertName = String(quotation.expert_name ?? '').trim();
  const expertId = await resolveExpertIdForQuotation(sb, quotation);

  const embeddedClientId =
    quotation.clients?.id != null ? String(quotation.clients.id) : null;
  const clientId = resolveClientIdForItinerary(
    quotation.client_id ?? embeddedClientId,
  );

  const dnaNotes = await fetchClientDnaSummaryNotes(sb, clientId);

  const title =
    clientName && clientName !== '—'
      ? `مسار ${clientName}`
      : quotation.title.trim() || destination;

  const firstFlight = quotation.flight_proposals.find(
    (f) => f.departureCity || f.arrivalCity,
  );
  const origin = String(firstFlight?.departureCity ?? '').trim();
  const arrival =
    String(firstFlight?.arrivalCity ?? '').trim() || cities[0] || destination;
  const geoType = countries.length > 1 || cities.length > 1 ? 'multi' : 'single';

  let daysData: unknown = {
    days: [],
    meta: {
      source_quotation_id: quotation.id,
      cities,
      countries,
      geo_trip_type: geoType,
      auto_from_approved_quotation: true,
      auto_from_kanban: true,
      ...(dnaNotes ? { travel_dna_summary: dnaNotes } : {}),
      client_name: clientName !== '—' ? clientName : null,
    },
  };
  daysData = withItineraryExpertMeta(daysData, expertId, expertName || null);

  const payload: Record<string, unknown> = {
    title,
    destination,
    customer_name: clientName !== '—' ? clientName : 'عميل VIP',
    /** رحلة جارية/مؤكدة في دليل المسارات الفردية */
    status: opts?.status ?? 'active',
    passcode,
    days_data: daysData,
    expected_profit: quotation.expected_profit,
    total_estimated_cost: quotation.total_estimated_cost,
    quotation_details: serializeQuotationDetails({
      enabled: true,
      hotelsEstimate: String(quotation.total_estimated_cost || ''),
      flightsEstimate: '',
      serviceFee: String(quotation.expected_profit || ''),
    }),
    is_quotation: false,
    cities,
    countries,
    geo_trip_type: geoType,
    flight_details: {
      flight_from: origin,
      flight_to: arrival,
      from_city: origin,
      to_city: arrival,
      cities,
      countries,
      trip_cities: cities,
      trip_countries: countries,
      geo_trip_type: geoType,
      destination_trip_type: geoType,
      ...(expertId ? { expert_id: expertId } : {}),
      ...(expertName ? { expert_name: expertName } : {}),
      proposals: buildFlightProposalsArray(quotation),
    },
  };

  if (clientId != null) payload.client_id = clientId;

  const quoteId = normalizeQuotationId(quotation.id);
  if (quoteId) payload.quote_id = quoteId;

  if (expertId) payload.expert_id = expertId;
  if (expertName) payload.expert_name = expertName;

  if (dnaNotes) {
    payload.notes = dnaNotes;
  }

  if (startDate) {
    payload.start_date = startDate;
    payload.end_date = endDate || startDate;
    payload.dates = buildDatesFieldFromParts(startDate, endDate || startDate);
  }

  const hotels = buildHotelDetails(quotation);
  if (hotels.length) payload.hotel_details = hotels;

  return payload;
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
    'quote_id',
    'expert_name',
    'expert_id',
    'customer_name',
    'client_id',
    'notes',
    'cities',
    'countries',
    'geo_trip_type',
  ]) {
    if (lower.includes(key)) {
      next = { ...next };
      delete next[key];
    }
  }
  return next;
}

async function insertItineraryWithSchemaFallback(
  sb: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ id: string | number; passcode: string }> {
  let insertRes = await sb.from('itineraries').insert(payload).select('id, passcode').single();

  let attempts = 0;
  let current = payload;
  while (
    insertRes.error &&
    /column|schema cache|does not exist/i.test(insertRes.error.message ?? '') &&
    attempts < 8
  ) {
    attempts += 1;
    current = stripQuotationItineraryPayload(insertRes.error.message ?? '', current);
    insertRes = await sb.from('itineraries').insert(current).select('id, passcode').single();
  }

  if (
    insertRes.error &&
    /expert_id|foreign key|violates foreign/i.test(insertRes.error.message ?? '')
  ) {
    const withoutExpertId = { ...current };
    delete withoutExpertId.expert_id;
    if (
      withoutExpertId.flight_details &&
      typeof withoutExpertId.flight_details === 'object'
    ) {
      const fd = { ...(withoutExpertId.flight_details as Record<string, unknown>) };
      delete fd.expert_id;
      withoutExpertId.flight_details = fd;
    }
    insertRes = await sb
      .from('itineraries')
      .insert(withoutExpertId)
      .select('id, passcode')
      .single();
  }

  if (insertRes.error || insertRes.data?.id == null) {
    throw new Error(insertRes.error?.message || 'فشل INSERT في جدول itineraries.');
  }

  return {
    id: insertRes.data.id as string | number,
    passcode: String(
      insertRes.data.passcode ?? payload.passcode ?? generateVipPasscode(),
    ),
  };
}

async function findExistingItineraryForQuotation(
  sb: SupabaseClient,
  quotation: QuotationRow,
): Promise<{ id: string; passcode: string | null } | null> {
  const quoteId = normalizeQuotationId(quotation.id);
  if (!quoteId) return null;

  const { data: byQuoteCol, error: quoteColErr } = await sb
    .from('itineraries')
    .select('id, passcode')
    .eq('quote_id', quoteId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!quoteColErr && byQuoteCol?.id != null) {
    return {
      id: String(byQuoteCol.id),
      passcode: byQuoteCol.passcode != null ? String(byQuoteCol.passcode) : null,
    };
  }

  const { data: byMeta, error: metaErr } = await sb
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

  const clientId = resolveClientIdForItinerary(
    quotation.client_id ??
      (quotation.clients?.id != null ? String(quotation.clients.id) : null),
  );
  const clientLabel = quotationClientName(quotation);
  const title =
    clientLabel !== '—'
      ? `مسار ${clientLabel}`
      : quotation.title.trim() || buildDestinationLabel(quotation);
  if (clientId == null || !title) return null;

  const { data: byClientTitle, error: titleErr } = await sb
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
  sb: SupabaseClient,
  itineraryId: string,
  quotation: QuotationRow,
): Promise<CreateItineraryFromQuotationResult | null> {
  // Always backfill relational + geography fields on existing empty rows
  const mapped = await buildMappedItineraryPayload(sb, quotation, {
    status: 'active',
  });
  delete mapped.passcode;

  // Guarantee client_id is present for Builder dropdown
  if (mapped.client_id == null && quotation.client_id) {
    mapped.client_id = resolveClientIdForItinerary(quotation.client_id);
  }

  let { data, error } = await sb
    .from('itineraries')
    .update({ ...mapped, updated_at: new Date().toISOString() })
    .eq('id', itineraryId)
    .select('id, passcode, client_id')
    .maybeSingle();

  if (
    error &&
    /column|schema cache|does not exist|foreign key|expert_id/i.test(error.message ?? '')
  ) {
    let stripped = stripQuotationItineraryPayload(error.message ?? '', mapped);
    if (/expert_id|foreign key/i.test(error.message ?? '')) {
      delete stripped.expert_id;
    }
    // Keep client_id if possible
    if (stripped.client_id == null && mapped.client_id != null) {
      stripped.client_id = mapped.client_id;
    }
    const retry = await sb
      .from('itineraries')
      .update({ ...stripped, updated_at: new Date().toISOString() })
      .eq('id', itineraryId)
      .select('id, passcode, client_id')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error || data?.id == null) {
    console.error('Failed to reactivate/backfill existing itinerary:', error);
    throw new Error(
      error?.message || `تعذر تحديث المسار الحالي #${itineraryId} بالبيانات الكاملة.`,
    );
  }

  return {
    itineraryId: data.id as string | number,
    passcode: String(data.passcode ?? generateVipPasscode()),
  };
}

/** يُنشئ مساراً نشطاً في itineraries بعد اعتماد/تأكيد عرض السعر */
export async function createItineraryFromApprovedQuotation(
  quotation: QuotationRow,
  client: SupabaseClient | null = supabase,
  options?: {
    throwOnError?: boolean;
    forceBackfill?: boolean;
    status?: 'draft' | 'active';
  },
): Promise<CreateItineraryFromQuotationResult | null> {
  const throwOnError = options?.throwOnError === true;
  const forceBackfill = options?.forceBackfill === true;
  const status = options?.status ?? 'active';

  if (!client) {
    const msg = 'Failed to auto-create itinerary: Supabase not configured';
    console.error(msg);
    if (throwOnError) throw new Error('Supabase غير مهيأ — تعذر توليد المسار.');
    return null;
  }

  try {
    const existing = await findExistingItineraryForQuotation(client, quotation);
    if (existing) {
      const reactivated = await reactivateExistingItinerary(
        client,
        existing.id,
        quotation,
      );
      if (reactivated) return reactivated;
      // Never return a hollow existing row when backfill was required
      if (forceBackfill || throwOnError) {
        throw new Error(
          `تعذر تعبئة المسار الحالي #${existing.id} ببيانات العرض (client/expert/cities).`,
        );
      }
      return {
        itineraryId: existing.id,
        passcode: existing.passcode ?? generateVipPasscode(),
      };
    }

    const payload = await buildMappedItineraryPayload(client, quotation, {
      status,
    });

    // Hard require client_id in payload when quotation has one
    if (quotation.client_id && payload.client_id == null) {
      payload.client_id = resolveClientIdForItinerary(quotation.client_id);
    }

    const inserted = await insertItineraryWithSchemaFallback(client, payload);
    return {
      itineraryId: inserted.id,
      passcode: inserted.passcode,
    };
  } catch (err) {
    console.error('Failed to auto-create itinerary:', err);
    if (throwOnError) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    return null;
  }
}

async function resolveQuotationForPipelineHandoff(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    quoteId?: string | null;
  },
): Promise<QuotationRow | null> {
  const selectFull =
    '*, clients(id, name, phone_wa), lead:leads(id, full_name, phone_wa, destinations, client_id)';

  const quoteId = normalizeQuotationId(opts.quoteId ?? '');
  if (quoteId) {
    let { data, error } = await sb
      .from('quotations')
      .select(selectFull)
      .eq('id', quoteId)
      .maybeSingle();
    if (error) {
      const plain = await sb.from('quotations').select('*').eq('id', quoteId).maybeSingle();
      data = plain.data;
    }
    if (data) return mapQuotationRow(data as Record<string, unknown>);
  }

  const leadId = String(opts.leadId ?? '').trim();
  if (leadId) {
    let { data, error } = await sb
      .from('quotations')
      .select(selectFull)
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      const plain = await sb
        .from('quotations')
        .select('*')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = plain.data;
    }
    if (data) return mapQuotationRow(data as Record<string, unknown>);
  }

  const clientRaw = opts.clientId;
  if (clientRaw != null && String(clientRaw).trim() !== '') {
    const variants = [String(clientRaw).trim()];
    const asNum = Number(clientRaw);
    if (Number.isFinite(asNum)) variants.push(String(asNum));

    for (const variant of variants) {
      let { data, error } = await sb
        .from('quotations')
        .select(selectFull)
        .eq('client_id', variant)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        const plain = await sb
          .from('quotations')
          .select('*')
          .eq('client_id', variant)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = plain.data;
      }
      if (data) return mapQuotationRow(data as Record<string, unknown>);
    }
  }

  return null;
}

/**
 * Pipeline handoff: payment_confirmed → ensure an itineraries row exists.
 * Idempotent — reuses + backfills existing itinerary when found.
 */
export async function ensureItineraryOnPaymentConfirmed(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    quoteId?: string | null;
  },
): Promise<CreateItineraryFromQuotationResult> {
  const quotation = await resolveQuotationForPipelineHandoff(sb, opts);
  if (quotation) {
    if (!quotation.client_id && quotation.clients?.id != null) {
      quotation.client_id = String(quotation.clients.id);
    }
    const created = await createItineraryFromApprovedQuotation(quotation, sb, {
      throwOnError: true,
    });
    if (created) return created;
    throw new Error('تعذر إنشاء المسار من عرض السعر.');
  }

  const fromLead = await createItineraryFromLeadFallback(sb, opts);
  if (fromLead) return fromLead;

  throw new Error(
    'لا يوجد عرض سعر مرتبط بهذا الطلب، وتعذر إنشاء مسار من بيانات الليد.',
  );
}

async function createItineraryFromLeadFallback(
  sb: SupabaseClient,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
  },
): Promise<CreateItineraryFromQuotationResult | null> {
  const leadId = String(opts.leadId ?? '').trim();
  let leadRow: Record<string, unknown> | null = null;

  if (leadId) {
    const { data, error } = await sb.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (error) throw new Error(error.message || 'تعذر قراءة الطلب.');
    leadRow = (data as Record<string, unknown> | null) ?? null;
  }

  if (!leadRow && opts.clientId != null) {
    const { data } = await sb
      .from('leads')
      .select('*')
      .eq('client_id', opts.clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    leadRow = (data as Record<string, unknown> | null) ?? null;
  }

  if (!leadRow) return null;

  const clientId = resolveClientIdForItinerary(
    (leadRow.client_id as string | number | null | undefined) ?? opts.clientId,
  );
  const destinations = Array.isArray(leadRow.destinations)
    ? (leadRow.destinations as string[]).map((d) => String(d).trim()).filter(Boolean)
    : [];
  const inferred = inferGeographyFromLabel(destinations.join(' · ') || 'رحلة VIP');
  const cities = destinations.length ? destinations : inferred.cities;
  const countries = inferred.countries;
  const destination = cities.join(' · ') || 'رحلة VIP';
  const customerName = String(leadRow.full_name ?? '').trim() || 'عميل VIP';
  const travelDate = String(leadRow.travel_date ?? '').trim().slice(0, 10);
  const passcode = generateVipPasscode();
  const title = `مسار ${customerName}`;
  const geoType = cities.length > 1 ? 'multi' : 'single';

  if (clientId != null) {
    const { data: existing } = await sb
      .from('itineraries')
      .select('id, passcode')
      .eq('client_id', clientId)
      .eq('title', title)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id != null) {
      await sb
        .from('itineraries')
        .update({
          client_id: clientId,
          customer_name: customerName,
          destination,
          cities,
          countries,
          flight_details: {
            cities,
            countries,
            trip_cities: cities,
            trip_countries: countries,
            geo_trip_type: geoType,
            destination_trip_type: geoType,
            flight_to: cities[0] || destination,
            to_city: cities[0] || destination,
          },
          days_data: {
            days: [],
            meta: {
              source_lead_id: leadId || null,
              cities,
              countries,
              auto_from_kanban: true,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return {
        itineraryId: existing.id as string | number,
        passcode: String(existing.passcode ?? passcode),
      };
    }
  }

  const payload: Record<string, unknown> = {
    title,
    destination,
    customer_name: customerName,
    status: 'draft',
    passcode,
    cities,
    countries,
    geo_trip_type: geoType,
    days_data: {
      days: [],
      meta: {
        source_lead_id: leadId || null,
        cities,
        countries,
        auto_from_kanban: true,
      },
    },
    flight_details: {
      cities,
      countries,
      trip_cities: cities,
      trip_countries: countries,
      geo_trip_type: geoType,
      destination_trip_type: geoType,
      flight_to: cities[0] || destination,
      to_city: cities[0] || destination,
    },
    is_quotation: false,
  };

  if (clientId != null) payload.client_id = clientId;
  if (travelDate) {
    payload.start_date = travelDate;
    payload.end_date = travelDate;
    payload.dates = buildDatesFieldFromParts(travelDate, travelDate);
  }

  const inserted = await insertItineraryWithSchemaFallback(sb, payload);
  return {
    itineraryId: inserted.id,
    passcode: inserted.passcode,
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

async function findItinerariesLinkedToQuotation(
  sb: SupabaseClient,
  quotation: QuotationRow,
): Promise<string[]> {
  const quoteId = normalizeQuotationId(quotation.id);
  if (!quoteId) return [];

  const ids = new Set<string>();

  const { data: byQuoteCol, error: quoteColErr } = await sb
    .from('itineraries')
    .select('id')
    .eq('quote_id', quoteId);

  if (!quoteColErr && byQuoteCol?.length) {
    for (const row of byQuoteCol) {
      if (row.id != null) ids.add(String(row.id));
    }
  }

  const { data: byMeta, error: metaErr } = await sb
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
    const { data: byTitle, error: titleErr } = await sb
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

async function archiveOrDeleteItinerary(
  sb: SupabaseClient,
  itineraryId: string,
): Promise<'deleted' | 'archived' | 'failed'> {
  const del = await sb.from('itineraries').delete().eq('id', itineraryId);
  if (!del.error) return 'deleted';

  const archive = await sb
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

  const itineraryIds = await findItinerariesLinkedToQuotation(supabase, quotation);
  const itineraryWarnings: string[] = [];
  let itinerariesCleaned = 0;

  for (const itineraryId of itineraryIds) {
    const outcome = await archiveOrDeleteItinerary(supabase, itineraryId);
    if (outcome === 'failed') {
      itineraryWarnings.push(`تعذر تنظيف المسار #${itineraryId}`);
    } else {
      itinerariesCleaned += 1;
    }
  }

  return { quotationId: quoteId, itinerariesCleaned, itineraryWarnings };
}
