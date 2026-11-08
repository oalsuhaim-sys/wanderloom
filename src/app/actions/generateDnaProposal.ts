'use server';

import { revalidatePath } from 'next/cache';

import { coerceClientDbId, type ClientDbId } from '@/lib/client-onboarding';
import {
  CRM_QUOTATIONS_TABLE,
  fetchQuotationIdByLeadIdAdmin,
} from '@/lib/crm-quotations-server';
import {
  dedupeQuotationHotelPlaces,
  serializeFlightProposalsForSave,
  serializeHotelProposalsForSave,
  type QuotationHotelPlace,
  type QuotationHotelProposal,
} from '@/lib/crm-quotations';
import {
  serializeActivityOptionsForSave,
  serializeHotelOptionsForSave,
  serializeItineraryDaysForSave,
  serializeTransportOptionsForSave,
} from '@/lib/interactive-quotation';
import { fetchPlaceCandidates } from '@/lib/dna-place-match';
import { buildDnaProposalDraft, addDaysIso, type DnaPlace } from '@/lib/dna-proposal-generator';
import { polishDnaDaysWithClaude } from '@/lib/dna-proposal-claude';
import { canonicalTripCountryId } from '@/lib/destination-match';
import { bankRowMatches, normalizeDestinations, type NormalizedDestination } from '@/lib/trip-destination-normalize';
import { generateProposalWithClaude } from '@/lib/ai-generate-proposal-claude';
import { mergeClaudeProposalIntoDraft } from '@/lib/ai-generate-proposal';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';

function todayIsoLocal(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isActiveTravelDate(travelDateRaw: unknown, now = new Date()): boolean {
  const iso = String(travelDateRaw ?? '')
    .trim()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso >= todayIsoLocal(now);
}

export type GenerateDnaProposalResult = {
  ok: boolean;
  quoteId: string | null;
  editUrl: string | null;
  leadId: string | null;
  clientId: ClientDbId | null;
  title?: string;
  startDate?: string;
  endDate?: string;
  daysCount?: number;
  hotelsCount?: number;
  stopsCount?: number;
  message?: string;
  error?: string;
};

type ClientDnaSnapshot = {
  name: string;
  phone: string;
  targetTrip: string;
  hotelPreference: string;
  flightSeat: string;
  dnaInterests: string[];
  dnaActivityLevel: string;
};

function parseInterestList(raw: unknown): string[] {
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
}

function parseDestinations(raw: unknown, fallbackTrip: string): string[] {
  if (Array.isArray(raw)) {
    return raw.map((d) => String(d ?? '').trim()).filter(Boolean);
  }
  const text = String(raw ?? '').trim() || String(fallbackTrip ?? '').trim();
  if (!text) return [];
  return text
    .split(/[·,،|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveLeadForClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientId: ClientDbId,
  preferredLeadId?: string | null,
): Promise<Record<string, unknown> | null> {
  const preferred = String(preferredLeadId ?? '').trim();
  if (preferred) {
    const { data } = await admin.from('leads').select('*').eq('id', preferred).maybeSingle();
    if (data) return data as Record<string, unknown>;
  }

  const { data: byClient } = await admin
    .from('leads')
    .select(
      'id, destinations, travel_date, travel_days, travelers_count, status, full_name, phone_wa, client_id, accommodation_type, interests, daily_pace, day_start_time, food_preferences, final_thoughts, created_at',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(12);

  const rows = (byClient ?? []) as Record<string, unknown>[];
  const active = rows.find((r) => isActiveTravelDate(r.travel_date));
  if (active) return active;
  if (rows[0]) return rows[0];

  const { data: client } = await admin
    .from('clients')
    .select('phone_wa')
    .eq('id', clientId)
    .maybeSingle();

  const phone = String(
    (client as { phone_wa?: string; phone_number?: string } | null)?.phone_wa ??
      (client as { phone_wa?: string; phone_number?: string } | null)?.phone_number ??
      '',
  ).trim();
  if (!phone) return null;

  const { data: byPhone } = await admin
    .from('leads')
    .select(
      'id, destinations, travel_date, travel_days, travelers_count, status, full_name, phone_wa, client_id, accommodation_type, interests, daily_pace, day_start_time, food_preferences, final_thoughts, created_at',
    )
    .eq('phone_wa', phone)
    .order('created_at', { ascending: false })
    .limit(8);

  const phoneRows = (byPhone ?? []) as Record<string, unknown>[];
  return phoneRows.find((r) => isActiveTravelDate(r.travel_date)) ?? phoneRows[0] ?? null;
}

async function fetchClientDnaSnapshot(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientId: ClientDbId,
): Promise<ClientDnaSnapshot> {
  const { data } = await admin
    .from('clients')
    .select(
      'id, name, phone_wa, target_trip, hotel_preference, flight_seat, dna_interests, dna_activity_level, travel_dna',
    )
    .eq('id', clientId)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, unknown>;
  const travelDna =
    row.travel_dna && typeof row.travel_dna === 'object' && !Array.isArray(row.travel_dna)
      ? (row.travel_dna as Record<string, unknown>)
      : {};

  return {
    name: String(row.name ?? '').trim() || 'عميل',
    phone: String(row.phone_wa ?? row.phone_number ?? '').trim(),
    targetTrip: String(row.target_trip ?? '').trim(),
    hotelPreference: String(
      row.hotel_preference ?? travelDna.hotel_style ?? travelDna.hotel_type ?? '',
    ).trim(),
    flightSeat: String(
      row.flight_seat ?? travelDna.preferred_seat ?? travelDna.flight_seat ?? '',
    ).trim(),
    dnaInterests: parseInterestList(row.dna_interests ?? travelDna.interests),
    dnaActivityLevel: String(row.dna_activity_level ?? '').trim(),
  };
}

function mapHotelRow(row: Record<string, unknown>): QuotationHotelPlace | null {
  const name = String(row.name ?? '').trim();
  if (!name) return null;
  return {
    id: String(row.id ?? ''),
    name,
    city: String(row.city ?? '').trim(),
    country: String(row.country ?? '').trim(),
    category: String(row.category ?? 'smart_choice'),
    room_types: [],
  };
}

async function fetchHotelBank(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<QuotationHotelPlace[]> {
  const { data, error } = await admin
    .from('hotels')
    .select('id, name, country, city, category')
    .order('name', { ascending: true });
  if (error) {
    console.warn('[generateDnaProposal] hotels:', error.message);
    return [];
  }
  const mapped = (data ?? [])
    .map((row) => mapHotelRow(row as Record<string, unknown>))
    .filter((h): h is QuotationHotelPlace => h != null);
  return dedupeQuotationHotelPlaces(mapped, 'name+city');
}

function hotelOptionsToProposals(
  options: { id: string; name: string; city: string; description: string; price: number }[],
): QuotationHotelProposal[] {
  return options
    .filter((h) => h.name.trim() || h.city.trim())
    .map((h) => ({
      id: h.id,
      hotel_name: h.name,
      city: h.city,
      room_type: h.description,
      price: Number(h.price) || 0,
    }));
}

async function insertDraftWithFallbacks(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
): Promise<{ id: string | null; error?: string }> {
  const attempts: Record<string, unknown>[] = [
    payload,
    (() => {
      const { itinerary_days: _i, hotel_options: _h, activity_options: _a, transport_options: _t, ...rest } =
        payload;
      return rest;
    })(),
    (() => {
      const {
        itinerary_days: _i,
        hotel_options: _h,
        activity_options: _a,
        transport_options: _t,
        expert_id: _e,
        lead_id: _l,
        ...rest
      } = payload;
      return rest;
    })(),
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const cleaned = Object.fromEntries(
      Object.entries(attempt).filter(([, v]) => v !== undefined),
    );
    const { data, error } = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .insert(cleaned)
      .select('id')
      .single();
    if (!error && data?.id) {
      return { id: String(data.id) };
    }
    lastError = error?.message ?? 'insert failed';
    if (!/column|schema cache|does not exist|check|constraint/i.test(lastError)) {
      break;
    }
  }
  return { id: null, error: lastError };
}

type DnaPlaceRow = { id: string; name: string; name_en: string | null; city: string | null; country: string | null; category: string | null; sub_tag: string | null; tip_ar: string | null; is_active: boolean | null };

/** Places for one destination: exact city (with spelling aliases) — never a country-wide grab bag. */
async function fetchPlacesForDestination(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  dest: NormalizedDestination,
): Promise<DnaPlace[]> {
  const select = 'id, name, name_en, city, country, category, sub_tag, tip_ar, is_active';
  const toPlace = (r: DnaPlaceRow): DnaPlace => ({
    id: String(r.id),
    name: String(r.name ?? '').trim(),
    name_en: String(r.name_en ?? '').trim() || undefined,
    city: String(r.city ?? '').trim() || undefined,
    category: String(r.category ?? '').trim() || undefined,
    sub_tag: String(r.sub_tag ?? '').trim() || undefined,
    tip: String(r.tip_ar ?? '').trim() || undefined,
  });
  const terms = [...new Set([dest.label, ...dest.aliases].map((t) => t.replace(/[%,()]/g, ' ').trim()).filter((t) => t.length >= 2))];
  const rows: DnaPlaceRow[] = [];
  if (!dest.countryOnly && terms.length) {
    const { data } = await admin
      .from('places')
      .select(select)
      .or(terms.map((t) => `city.ilike.%${t}%`).join(','))
      .limit(3000);
    rows.push(...(((data ?? []) as unknown as DnaPlaceRow[]).filter((r) => r.is_active !== false && bankRowMatches(dest, r))));
  }
  // An area without its own bank city (e.g. «نامي»): places whose name mentions it, in the same country.
  if (!rows.length && !dest.countryOnly) {
    const latin = terms.filter((t) => /^[a-z\s]+$/i.test(t));
    if (latin.length) {
      const { data } = await admin
        .from('places')
        .select(select)
        .or(latin.flatMap((t) => [`name.ilike.%${t}%`, `name_en.ilike.%${t}%`]).join(','))
        .limit(60);
      const word = new RegExp(`\\b(${latin.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
      rows.push(
        ...(((data ?? []) as unknown as DnaPlaceRow[]).filter(
          (r) =>
            r.is_active !== false &&
            word.test(`${r.name ?? ''} ${r.name_en ?? ''}`) &&
            (!dest.countryId || canonicalTripCountryId(String(r.country ?? '')) === dest.countryId),
        )),
      );
    }
  }
  if (dest.countryOnly && dest.countryId) {
    const { data } = await admin.from('places').select(select).limit(3000);
    rows.push(...(((data ?? []) as unknown as DnaPlaceRow[]).filter((r) => r.is_active !== false && canonicalTripCountryId(String(r.country ?? '')) === dest.countryId)));
  }
  const seen = new Set<string>();
  return rows.map(toPlace).filter((p) => p.id && p.name && !seen.has(p.id) && Boolean(seen.add(p.id)));
}

function lodgingRequest(lead: Record<string, unknown> | null, dna: ClientDnaSnapshot): string {
  const fromLead = Array.isArray(lead?.accommodation_type)
    ? (lead!.accommodation_type as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ')
    : String(lead?.accommodation_type ?? '').trim();
  return [fromLead, dna.hotelPreference].filter(Boolean).join(' · ');
}

function dreamFromLead(lead: Record<string, unknown> | null): { dream: string; firstVisit: boolean } {
  const text = String(lead?.final_thoughts ?? '').trim();
  const [first] = text.split(/\n\s*زيارات سابقة/);
  return { dream: String(first ?? '').trim().slice(0, 300), firstVisit: /لم يسبق/.test(text) };
}

/**
 * One-click: build a full draft quotation from client DNA + trip window.
 * From inside a quote, pass its current destinations/dates (+ quoteId) to rebuild that quote in place.
 */
export async function generateDnaProposalAction(input: {
  clientId: ClientDbId | string | number | null;
  leadId?: string | null;
  /** Rebuild this quote in place (keeps prices, transport and flights the expert already filled). */
  quoteId?: string | null;
  destinations?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<GenerateDnaProposalResult> {
  const clientId = coerceClientDbId(input.clientId);
  if (clientId == null) {
    return { ok: false, quoteId: null, editUrl: null, leadId: null, clientId: null, error: 'معرّف العميل غير صالح.' };
  }

  try {
    const admin = createSupabaseAdminClient();
    const dna = await fetchClientDnaSnapshot(admin, clientId);
    const lead = await resolveLeadForClient(admin, clientId, input.leadId);
    const leadId = lead?.id != null ? String(lead.id).trim() : null;

    // The quote's own (edited) destinations and dates win over the original request.
    const overrideDests = (input.destinations ?? []).map((d) => String(d ?? '').trim()).filter(Boolean);
    const rawDestinations = overrideDests.length ? overrideDests : parseDestinations(lead?.destinations, dna.targetTrip);
    const dests = normalizeDestinations(rawDestinations);

    const isoOk = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').slice(0, 10));
    const overrideStart = isoOk(input.startDate) ? String(input.startDate).slice(0, 10) : '';
    const overrideEnd = isoOk(input.endDate) ? String(input.endDate).slice(0, 10) : '';
    const travelDate = String(lead?.travel_date ?? '').trim().slice(0, 10);
    const startDate = overrideStart || (isoOk(travelDate) ? travelDate : new Date().toISOString().slice(0, 10));
    let durationDays = 0;
    if (overrideStart && overrideEnd && overrideEnd >= overrideStart) {
      durationDays = Math.round((Date.parse(`${overrideEnd}T00:00:00Z`) - Date.parse(`${overrideStart}T00:00:00Z`)) / 86_400_000) + 1;
    }
    if (!durationDays) {
      const travelDaysRaw = Number(lead?.travel_days);
      durationDays = Number.isFinite(travelDaysRaw) && travelDaysRaw > 0 ? Math.floor(travelDaysRaw) : Math.max(3, dests.length * 3);
    }

    const leadInterests = parseInterestList(lead?.interests);
    const interests = [...new Set([...dna.dnaInterests, ...leadInterests])];
    const food = parseInterestList(lead?.food_preferences);
    const lodging = lodgingRequest(lead, dna);
    const { dream, firstVisit } = dreamFromLead(lead);

    const [hotelBank, placeLists] = await Promise.all([
      fetchHotelBank(admin),
      Promise.all(dests.map((d) => fetchPlacesForDestination(admin, d))),
    ]);
    const placesByDestination: Record<string, DnaPlace[]> = {};
    dests.forEach((d, i) => {
      placesByDestination[d.key] = placeLists[i] ?? [];
    });

    // Rebuilding: keep the expert's nights per city when the cities are unchanged.
    let existingRow: Record<string, unknown> | null = null;
    const nightsByDestination: Record<string, number> = {};
    if (input.quoteId) {
      const { data } = await admin
        .from(CRM_QUOTATIONS_TABLE)
        .select('id, title, itinerary_days, transport_options, flight_proposals, status')
        .eq('id', input.quoteId)
        .maybeSingle();
      existingRow = (data ?? null) as Record<string, unknown> | null;
      const oldDays = Array.isArray(existingRow?.itinerary_days) ? (existingRow!.itinerary_days as Array<{ city?: string }>) : [];
      for (const d of oldDays) {
        const nd = normalizeDestinations([d.city ?? ''])[0];
        if (nd) nightsByDestination[nd.key] = (nightsByDestination[nd.key] ?? 0) + 1;
      }
    }

    const draft = buildDnaProposalDraft({
      clientName: dna.name,
      destinations: dests.map((d) => d.raw),
      startDate,
      durationDays,
      hotelPreference: lodging,
      flightSeat: dna.flightSeat,
      dnaInterests: interests,
      pace: String(lead?.daily_pace ?? dna.dnaActivityLevel ?? ''),
      dayStart: String(lead?.day_start_time ?? ''),
      hotelBank,
      placesByDestination,
      nightsByDestination,
    });

    const polish = await polishDnaDaysWithClaude(draft.itineraryDays, {
      clientName: dna.name,
      interests,
      pace: String(lead?.daily_pace ?? dna.dnaActivityLevel ?? ''),
      food,
      lodging,
      dream,
      notes: '',
      firstVisit,
      travelers: String(lead?.travelers_count ?? '').trim() ? `${String(lead?.travelers_count)} مسافر` : '',
      country: dests.find((d) => d.countryLabel)?.countryLabel ?? '',
    });
    const itineraryDays = polish.days;

    // Target quote: explicit rebuild → that quote; else reuse an empty draft for this lead; else insert.
    let quoteId: string | null = existingRow ? String(existingRow.id) : null;
    if (!quoteId && leadId) {
      const existingId = await fetchQuotationIdByLeadIdAdmin(leadId).catch(() => null);
      if (existingId) {
        const { data: existing } = await admin
          .from(CRM_QUOTATIONS_TABLE)
          .select('id, itinerary_days, hotel_options')
          .eq('id', existingId)
          .maybeSingle();
        const row = (existing ?? {}) as Record<string, unknown>;
        const days = Array.isArray(row.itinerary_days) ? row.itinerary_days : [];
        const hotels = Array.isArray(row.hotel_options) ? row.hotel_options : [];
        const hasContent =
          days.some((d) => {
            const r = d as Record<string, unknown>;
            return String(r?.city ?? '').trim() || String(r?.title ?? '').trim() || (Array.isArray(r?.stops) && r.stops.length > 0);
          }) || hotels.some((h) => String((h as { name?: string })?.name ?? '').trim());
        if (!hasContent) quoteId = existingId;
      }
    }

    const expertId = String(lead?.expert_id ?? lead?.assigned_expert_id ?? '').trim();
    const hasContent = (v: unknown) =>
      Array.isArray(v) && v.some((x) => String((x as { name?: string; airline?: string })?.name ?? (x as { airline?: string })?.airline ?? '').trim());
    const oldTitle = String(existingRow?.title ?? '').trim();
    const keepTitle = oldTitle && !/^عرض سعر DNA|^رحلة /.test(oldTitle);

    const payload: Record<string, unknown> = {
      client_id: clientId,
      title: keepTitle ? oldTitle : draft.title,
      destinations: draft.destinations,
      start_date: draft.startDate || null,
      end_date: draft.endDate || null,
      hotel_proposals: serializeHotelProposalsForSave(hotelOptionsToProposals(draft.hotelOptions)),
      itinerary_days: serializeItineraryDaysForSave(itineraryDays),
      hotel_options: serializeHotelOptionsForSave(draft.hotelOptions),
      activity_options: serializeActivityOptionsForSave(draft.activityOptions),
      updated_at: new Date().toISOString(),
      ...(existingRow
        ? {
            ...(hasContent(existingRow.transport_options) ? {} : { transport_options: serializeTransportOptionsForSave(draft.transportOptions) }),
            ...(hasContent(existingRow.flight_proposals) ? {} : { flight_proposals: serializeFlightProposalsForSave(draft.flightProposals) }),
          }
        : {
            total_estimated_cost: 0,
            expected_profit: 0,
            status: 'draft',
            flight_proposals: serializeFlightProposalsForSave(draft.flightProposals),
            transport_options: serializeTransportOptionsForSave(draft.transportOptions),
            activities: [],
            transportation: [],
            lead_source: 'dna_auto',
          }),
      ...(leadId ? { lead_id: leadId } : {}),
      ...(expertId ? { expert_id: expertId } : {}),
    };

    if (quoteId) {
      const { error: updErr } = await admin.from(CRM_QUOTATIONS_TABLE).update(payload).eq('id', quoteId);
      if (updErr) {
        const lean = { ...payload };
        delete lean.itinerary_days;
        delete lean.hotel_options;
        delete lean.activity_options;
        delete lean.transport_options;
        const { error: leanErr } = await admin.from(CRM_QUOTATIONS_TABLE).update(lean).eq('id', quoteId);
        if (leanErr) {
          return { ok: false, quoteId: null, editUrl: null, leadId, clientId, error: leanErr.message || updErr.message };
        }
      }
    } else {
      const inserted = await insertDraftWithFallbacks(admin, payload);
      if (!inserted.id) {
        return { ok: false, quoteId: null, editUrl: null, leadId, clientId, error: inserted.error || 'تعذر إنشاء مسودة عرض السعر.' };
      }
      quoteId = inserted.id;
    }

    if (leadId && !existingRow) {
      await updatePipelineStatus(admin, { leadId, clientId, force: true }, 'quote_stage').catch(() => undefined);
    }

    revalidatePath('/crm/quotations');
    revalidatePath(`/crm/quotations/edit/${quoteId}`);
    revalidatePath(`/crm/clients/${clientId}`);
    revalidatePath(`/proposal/${quoteId}`);
    revalidatePath('/crm');

    const hotelsCount = draft.hotelOptions.filter((h) => h.name.trim()).length;
    const gaps = [
      draft.citiesWithoutHotels.length ? `لا فنادق في البنك لـ: ${draft.citiesWithoutHotels.join('، ')}` : '',
      draft.citiesWithoutPlaces.length ? `لا أماكن في البنك لـ: ${draft.citiesWithoutPlaces.join('، ')}` : '',
    ].filter(Boolean);

    return {
      ok: true,
      quoteId,
      editUrl: `/crm/quotations/edit/${encodeURIComponent(quoteId)}`,
      leadId,
      clientId,
      title: String(payload.title),
      startDate: draft.startDate,
      endDate: draft.endDate,
      daysCount: itineraryDays.length,
      hotelsCount,
      stopsCount: draft.stopsFilled,
      message: `${existingRow ? 'أُعيد بناء العرض' : 'تم تجهيز العرض'} من DNA: ${itineraryDays.length} أيام · ${hotelsCount} فنادق · ${draft.stopsFilled} محطات${polish.polished ? '' : ' (النصوص الأساسية — راجعها)'}${gaps.length ? ` · ${gaps.join(' · ')}` : ''}`,
    };
  } catch (err) {
    console.error('[generateDnaProposalAction]', err);
    return {
      ok: false,
      quoteId: null,
      editUrl: null,
      leadId: String(input.leadId ?? '').trim() || null,
      clientId,
      error: err instanceof Error ? err.message : 'تعذر توليد عرض السعر من DNA.',
    };
  }
}

/**
 * One-click: Claude AI drafts a full quotation from DNA + active trip dates,
 * then saves a draft and returns the proposal builder edit URL.
 */
export async function generateClaudeProposalAction(input: {
  clientId: ClientDbId | string | number | null;
  leadId?: string | null;
}): Promise<GenerateDnaProposalResult> {
  const clientId = coerceClientDbId(input.clientId);
  if (clientId == null) {
    return {
      ok: false,
      quoteId: null,
      editUrl: null,
      leadId: null,
      clientId: null,
      error: 'معرّف العميل غير صالح.',
    };
  }

  try {
    const admin = createSupabaseAdminClient();
    const dna = await fetchClientDnaSnapshot(admin, clientId);
    const lead = await resolveLeadForClient(admin, clientId, input.leadId);

    const leadId = lead?.id != null ? String(lead.id).trim() : null;
    const destinations = normalizeDestinations(parseDestinations(lead?.destinations, dna.targetTrip)).map((d) => d.label);
    const travelDate = String(lead?.travel_date ?? '').trim().slice(0, 10);
    const travelDaysRaw = Number(lead?.travel_days);
    const durationDays =
      Number.isFinite(travelDaysRaw) && travelDaysRaw > 0
        ? Math.floor(travelDaysRaw)
        : Math.max(3, destinations.length * 3 || 5);

    const startDate =
      travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate)
        ? travelDate
        : new Date().toISOString().slice(0, 10);
    const endDate = addDaysIso(startDate, durationDays - 1);

    const hotelFromLead = Array.isArray(lead?.accommodation_type)
      ? (lead!.accommodation_type as unknown[])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' · ')
      : String(lead?.accommodation_type ?? '').trim();

    const leadInterests = parseInterestList(lead?.interests);
    const interests = [...new Set([...dna.dnaInterests, ...leadInterests])];
    const hotelPreference = dna.hotelPreference || hotelFromLead;

    const hotelBank = await fetchHotelBank(admin);
    const placeBuckets = await Promise.all(
      (destinations.length ? destinations : [dna.targetTrip || '']).map((dest) =>
        fetchPlaceCandidates(admin, {
          destination: dest,
          interests,
          limit: 36,
        }),
      ),
    );
    const seenPlaces = new Set<string>();
    const placeCandidates = placeBuckets.flat().filter((p) => {
      if (!p.id || seenPlaces.has(p.id)) return false;
      seenPlaces.add(p.id);
      return true;
    });

    const paxRaw = Number(lead?.travelers_count);

    const claudeResult = await generateProposalWithClaude({
      clientName: dna.name,
      destinations,
      travelDate: startDate,
      endDate,
      durationDays,
      passengersCount:
        Number.isFinite(paxRaw) && paxRaw > 0 ? Math.floor(paxRaw) : null,
      hotelPreference,
      flightSeat: dna.flightSeat,
      dnaInterests: interests,
      dnaActivityLevel: dna.dnaActivityLevel,
      hotelBankPreview: hotelBank.slice(0, 80).map((h) => ({
        name: h.name,
        city: h.city,
        category: h.category,
      })),
      placeCandidates,
    });

    if (!claudeResult.ok) {
      return {
        ok: false,
        quoteId: null,
        editUrl: null,
        leadId,
        clientId,
        error: claudeResult.message,
      };
    }

    const draft = mergeClaudeProposalIntoDraft({
      clientName: dna.name,
      destinations,
      startDate,
      endDate,
      hotelPreference,
      flightSeat: dna.flightSeat,
      dnaInterests: interests,
      claude: claudeResult.payload,
      hotelBank,
    });

    let quoteId: string | null = null;
    if (leadId) {
      const existingId = await fetchQuotationIdByLeadIdAdmin(leadId).catch(() => null);
      if (existingId) {
        const { data: existing } = await admin
          .from(CRM_QUOTATIONS_TABLE)
          .select('id, itinerary_days, hotel_options')
          .eq('id', existingId)
          .maybeSingle();
        const row = (existing ?? {}) as Record<string, unknown>;
        const days = Array.isArray(row.itinerary_days) ? row.itinerary_days : [];
        const hotels = Array.isArray(row.hotel_options) ? row.hotel_options : [];
        const hasContent =
          days.some((d) => {
            const r = d as Record<string, unknown>;
            return (
              String(r?.city ?? '').trim() ||
              String(r?.title ?? '').trim() ||
              (Array.isArray(r?.stops) && r.stops.length > 0)
            );
          }) ||
          hotels.some((h) => String((h as { name?: string })?.name ?? '').trim());
        if (!hasContent) quoteId = existingId;
      }
    }

    const expertId = String(lead?.expert_id ?? lead?.assigned_expert_id ?? '').trim();

    const payload: Record<string, unknown> = {
      client_id: clientId,
      title: draft.title,
      destinations: draft.destinations,
      start_date: draft.startDate || null,
      end_date: draft.endDate || null,
      total_estimated_cost: 0,
      expected_profit: 0,
      status: 'draft',
      flight_proposals: serializeFlightProposalsForSave(draft.flightProposals),
      hotel_proposals: serializeHotelProposalsForSave(
        hotelOptionsToProposals(draft.hotelOptions),
      ),
      activities: [],
      transportation: [],
      itinerary_days: serializeItineraryDaysForSave(draft.itineraryDays),
      hotel_options: serializeHotelOptionsForSave(draft.hotelOptions),
      activity_options: serializeActivityOptionsForSave(draft.activityOptions),
      transport_options: serializeTransportOptionsForSave(draft.transportOptions),
      lead_source: 'claude_ai',
      updated_at: new Date().toISOString(),
      ...(leadId ? { lead_id: leadId } : {}),
      ...(expertId ? { expert_id: expertId } : {}),
    };

    if (quoteId) {
      const { error: updErr } = await admin
        .from(CRM_QUOTATIONS_TABLE)
        .update(payload)
        .eq('id', quoteId);
      if (updErr) {
        const lean = { ...payload };
        delete lean.itinerary_days;
        delete lean.hotel_options;
        delete lean.activity_options;
        delete lean.transport_options;
        const { error: leanErr } = await admin
          .from(CRM_QUOTATIONS_TABLE)
          .update(lean)
          .eq('id', quoteId);
        if (leanErr) {
          return {
            ok: false,
            quoteId: null,
            editUrl: null,
            leadId,
            clientId,
            error: leanErr.message || updErr.message,
          };
        }
      }
    } else {
      const inserted = await insertDraftWithFallbacks(admin, payload);
      if (!inserted.id) {
        return {
          ok: false,
          quoteId: null,
          editUrl: null,
          leadId,
          clientId,
          error: inserted.error || 'تعذر حفظ مسودة عرض Claude.',
        };
      }
      quoteId = inserted.id;
    }

    if (leadId) {
      await updatePipelineStatus(
        admin,
        { leadId, clientId, force: true },
        'quote_stage',
      ).catch(() => undefined);
    }

    revalidatePath('/crm/quotations');
    revalidatePath(`/crm/quotations/edit/${quoteId}`);
    revalidatePath(`/crm/clients/${clientId}`);
    revalidatePath('/crm');

    return {
      ok: true,
      quoteId,
      editUrl: `/crm/quotations/edit/${encodeURIComponent(quoteId)}`,
      leadId,
      clientId,
      title: draft.title,
      startDate: draft.startDate,
      endDate: draft.endDate,
      daysCount: draft.itineraryDays.length,
      hotelsCount: draft.hotelOptions.filter((h) => h.name.trim()).length,
      stopsCount: draft.stopsFilled,
      message: `تم توليد العرض بواسطة Claude AI: ${draft.itineraryDays.length} أيام · ${draft.hotelOptions.filter((h) => h.name.trim()).length} فنادق · ${draft.stopsFilled} محطات ✨`,
    };
  } catch (err) {
    console.error('[generateClaudeProposalAction]', err);
    return {
      ok: false,
      quoteId: null,
      editUrl: null,
      leadId: String(input.leadId ?? '').trim() || null,
      clientId,
      error: err instanceof Error ? err.message : 'تعذر توليد عرض السعر بواسطة Claude AI.',
    };
  }
}
