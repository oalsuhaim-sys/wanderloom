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
import { buildDnaProposalDraft, addDaysIso } from '@/lib/dna-proposal-generator';
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
      'id, destinations, travel_date, travel_days, travelers_count, status, full_name, phone_wa, client_id, expert_id, assigned_expert_id, accommodation_type, interests, created_at',
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
    .select('phone_wa, phone_number')
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
      'id, destinations, travel_date, travel_days, travelers_count, status, full_name, phone_wa, client_id, expert_id, assigned_expert_id, accommodation_type, interests, created_at',
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
      'id, name, phone_wa, phone_number, target_trip, hotel_preference, flight_seat, dna_interests, dna_activity_level, travel_dna',
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

/**
 * One-click: build a full draft quotation from client DNA + active trip dates.
 */
export async function generateDnaProposalAction(input: {
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
    const destinations = parseDestinations(
      lead?.destinations,
      dna.targetTrip,
    );
    const travelDate = String(lead?.travel_date ?? '').trim().slice(0, 10);
    const travelDaysRaw = Number(lead?.travel_days);
    const durationDays =
      Number.isFinite(travelDaysRaw) && travelDaysRaw > 0
        ? Math.floor(travelDaysRaw)
        : Math.max(3, destinations.length * 3);

    const startDate =
      travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate)
        ? travelDate
        : new Date().toISOString().slice(0, 10);

    const hotelFromLead = Array.isArray(lead?.accommodation_type)
      ? (lead!.accommodation_type as unknown[])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join(' · ')
      : String(lead?.accommodation_type ?? '').trim();

    const leadInterests = parseInterestList(lead?.interests);
    const interests = [...new Set([...dna.dnaInterests, ...leadInterests])];

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

    const draft = buildDnaProposalDraft({
      clientName: dna.name,
      destinations,
      startDate,
      durationDays,
      hotelPreference: dna.hotelPreference || hotelFromLead,
      flightSeat: dna.flightSeat,
      dnaInterests: interests,
      dnaActivityLevel: dna.dnaActivityLevel,
      hotelBank,
      placeCandidates,
    });

    // Prefer enriching an existing empty draft for this lead; otherwise insert new.
    let quoteId: string | null = null;
    if (leadId) {
      const existingId = await fetchQuotationIdByLeadIdAdmin(leadId).catch(() => null);
      if (existingId) {
        const { data: existing } = await admin
          .from(CRM_QUOTATIONS_TABLE)
          .select('id, itinerary_days, hotel_options, status')
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

        if (!hasContent) {
          quoteId = existingId;
        }
      }
    }

    const expertId = String(
      lead?.expert_id ?? lead?.assigned_expert_id ?? '',
    ).trim();

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
      lead_source: 'dna_auto',
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
        // Retry without interactive columns
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
          error: inserted.error || 'تعذر إنشاء مسودة عرض السعر.',
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

    const endDate = draft.endDate || (draft.startDate ? addDaysIso(draft.startDate, durationDays - 1) : '');

    return {
      ok: true,
      quoteId,
      editUrl: `/crm/quotations/edit/${encodeURIComponent(quoteId)}`,
      leadId,
      clientId,
      title: draft.title,
      startDate: draft.startDate,
      endDate,
      daysCount: draft.itineraryDays.length,
      hotelsCount: draft.hotelOptions.filter((h) => h.name.trim()).length,
      stopsCount: draft.stopsFilled,
      message: `تم توليد مسودة العرض من DNA: ${draft.itineraryDays.length} أيام · ${draft.hotelOptions.filter((h) => h.name.trim()).length} فنادق · ${draft.stopsFilled} محطات`,
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
    const destinations = parseDestinations(lead?.destinations, dna.targetTrip);
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
