'use server';

import { revalidatePath } from 'next/cache';

import { coerceClientDbId, type ClientDbId } from '@/lib/client-onboarding';
import {
  convertLeadToQuotationAdmin,
  fetchQuotationIdByLeadIdAdmin,
  CRM_QUOTATIONS_TABLE,
} from '@/lib/crm-quotations-server';
import { siteOrigin } from '@/lib/bank-checkout';
import { buildQuotationPublicLink } from '@/lib/whatsapp-templates';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AutoQuotationAfterDnaResult = {
  ok: boolean;
  quoteId: string | null;
  leadId: string | null;
  clientId: number | null;
  created: boolean;
  quotationUrl?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  tripTitle?: string | null;
  message?: string;
  error?: string;
};

type ClientDnaSnapshot = {
  name: string;
  phone: string;
  targetTrip: string;
  hotelPreference: string;
  flightSeat: string;
  foodAllergies: string;
  favoriteDrink: string;
  dnaInterests: string[];
  dnaSpecialRequests: string;
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

async function resolveLeadIdForClient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientId: number,
): Promise<string | null> {
  const { data: byClient } = await admin
    .from('leads')
    .select('id, status, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10);

  const rows = (byClient ?? []) as Array<{ id?: unknown; status?: unknown }>;
  const preferred =
    rows.find((r) => {
      const s = String(r.status ?? '').trim().toLowerCase();
      return (
        s === 'meeting' ||
        s === 'awaiting_dna' ||
        s === 'dna_sent' ||
        s === 'dna_pending' ||
        s === 'quote_stage'
      );
    }) ?? rows[0];

  if (preferred?.id != null) return String(preferred.id).trim() || null;

  const { data: client } = await admin
    .from('clients')
    .select('phone_wa, phone_number, name')
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
    .select('id, client_id')
    .eq('phone_wa', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byPhone?.id) return null;
  const leadId = String(byPhone.id).trim();
  if (!(byPhone as { client_id?: unknown }).client_id) {
    await admin.from('leads').update({ client_id: clientId }).eq('id', leadId);
  }
  return leadId || null;
}

async function fetchClientDnaSnapshot(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  clientId: number,
): Promise<ClientDnaSnapshot> {
  const { data } = await admin
    .from('clients')
    .select(
      'id, name, phone_wa, phone_number, target_trip, hotel_preference, flight_seat, food_allergies, favorite_drink, dna_interests, dna_special_requests, dna_activity_level, travel_dna',
    )
    .eq('id', clientId)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, unknown>;
  const travelDna =
    row.travel_dna && typeof row.travel_dna === 'object' && !Array.isArray(row.travel_dna)
      ? (row.travel_dna as Record<string, unknown>)
      : {};

  const hotelPreference = String(
    row.hotel_preference ?? travelDna.hotel_style ?? travelDna.hotel_type ?? '',
  ).trim();
  const flightSeat = String(row.flight_seat ?? travelDna.preferred_seat ?? travelDna.flight_seat ?? '').trim();
  const foodAllergies = String(
    row.food_allergies ?? travelDna.food_allergies ?? travelDna.food_preference ?? '',
  ).trim();
  const favoriteDrink = String(
    row.favorite_drink ?? travelDna.drink_coffee ?? travelDna.favorite_drink ?? '',
  ).trim();

  return {
    name: String(row.name ?? '').trim() || 'عميل',
    phone: String(row.phone_wa ?? row.phone_number ?? '').trim(),
    targetTrip: String(row.target_trip ?? '').trim(),
    hotelPreference,
    flightSeat,
    foodAllergies,
    favoriteDrink,
    dnaInterests: parseInterestList(row.dna_interests ?? travelDna.interests),
    dnaSpecialRequests: String(row.dna_special_requests ?? '').trim(),
    dnaActivityLevel: String(row.dna_activity_level ?? '').trim(),
  };
}

/**
 * Activate quotation after DNA — promote draft → pending_client.
 * DNA prefs stay in the client profile and appear as a read-only guide in the
 * quote builder — they must NOT be written into pricing JSON rows.
 */
async function enrichAndActivateQuotationFromDna(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  quoteId: string,
  dna: ClientDnaSnapshot,
): Promise<{ title: string }> {
  const { data: existing } = await admin
    .from(CRM_QUOTATIONS_TABLE)
    .select('id, title, status')
    .eq('id', quoteId)
    .maybeSingle();

  const row = (existing ?? {}) as Record<string, unknown>;
  const title = String(row.title ?? '').trim() || `عرض سعر - ${dna.name}`;
  const currentStatus = String(row.status ?? '').trim().toLowerCase();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (!currentStatus || currentStatus === 'draft') {
    patch.status = 'pending_client';
  }

  const attempts: Record<string, unknown>[] = [
    patch,
    {
      status: patch.status ?? 'pending_client',
      updated_at: patch.updated_at,
    },
  ];

  for (const attempt of attempts) {
    const cleaned = Object.fromEntries(
      Object.entries(attempt).filter(([, v]) => v !== undefined),
    );
    if (!Object.keys(cleaned).length) continue;
    const { error } = await admin.from(CRM_QUOTATIONS_TABLE).update(cleaned).eq('id', quoteId);
    if (!error) break;
    if (!/column|schema cache|does not exist|check|constraint/i.test(error.message ?? '')) {
      console.warn('[enrichAndActivateQuotationFromDna]', error.message);
      break;
    }
  }

  return { title };
}

async function insertDnaQuoteTeamNotifications(input: {
  clientId: number;
  clientName: string;
  leadId: string | null;
  quoteId: string;
}): Promise<number> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return 0;
  }

  const name = input.clientName.trim() || 'عميل';
  const link = `/crm/quotations/${encodeURIComponent(input.quoteId)}`;
  const message = `تم إكمال DNA للعميل ${name} وتم تجهيز عرض السعر للعميل!`;

  const rows = [
    {
      role: 'admin',
      title: 'DNA مكتمل · عرض سعر جاهز',
      message,
      link,
      client_id: input.clientId,
      lead_id: input.leadId,
    },
    {
      role: 'ops',
      title: 'DNA مكتمل · عرض سعر جاهز',
      message,
      link,
      client_id: input.clientId,
      lead_id: input.leadId,
    },
    {
      role: 'expert',
      title: 'DNA مكتمل · عرض سعر جاهز',
      message,
      link,
      client_id: input.clientId,
      lead_id: input.leadId,
    },
  ];

  const { error } = await admin.from('crm_team_notifications').insert(rows as never);
  if (error) {
    if (!/does not exist|schema cache|relation/i.test(error.message)) {
      console.warn('[autoQuotationAfterDna] notifications:', error.message);
    }
    return 0;
  }
  return rows.length;
}

function buildSuccessPayload(input: {
  quoteId: string;
  leadId: string | null;
  clientId: number;
  created: boolean;
  dna: ClientDnaSnapshot;
  title: string;
  origin?: string | null;
}): AutoQuotationAfterDnaResult {
  const quotationUrl = buildQuotationPublicLink(input.quoteId, input.origin ?? siteOrigin());
  return {
    ok: true,
    quoteId: input.quoteId,
    leadId: input.leadId,
    clientId: input.clientId,
    created: input.created,
    quotationUrl,
    clientName: input.dna.name,
    clientPhone: input.dna.phone || null,
    tripTitle: input.title,
    message: `تم إكمال الـ DNA بنجاح! عرض السعر جاهز الآن للعميل.`,
  };
}

/**
 * After Travel DNA submission: create/find quotation, inject DNA prefs, promote to pending_client.
 */
export async function autoCreateQuotationAfterDnaAdmin(input: {
  clientId: ClientDbId | string | number | null;
  leadId?: string | null;
  origin?: string | null;
}): Promise<AutoQuotationAfterDnaResult> {
  const clientId = coerceClientDbId(input.clientId);
  if (clientId == null) {
    return {
      ok: false,
      quoteId: null,
      leadId: null,
      clientId: null,
      created: false,
      error: 'معرّف العميل غير صالح.',
    };
  }

  try {
    const admin = createSupabaseAdminClient();
    const dna = await fetchClientDnaSnapshot(admin, clientId);

    let leadId = String(input.leadId ?? '').trim() || null;
    if (!leadId) {
      leadId = await resolveLeadIdForClient(admin, clientId);
    }

    if (!leadId) {
      const destination = dna.targetTrip;
      const destinations = destination
        ? destination.split(/[·,،|/]+/).map((s) => s.trim()).filter(Boolean)
        : [];

      const payload: Record<string, unknown> = {
        client_id: clientId,
        title: `عرض سعر - ${dna.name}`,
        destinations,
        status: 'pending_client',
        total_estimated_cost: 0,
        expected_profit: 0,
        flight_proposals: [],
        hotel_proposals: [],
        activities: [],
        transportation: [],
        lead_source: 'dna_auto',
      };

      let insert = await admin
        .from(CRM_QUOTATIONS_TABLE)
        .insert(payload)
        .select('id')
        .single();

      if (insert.error && /status|check|pending_client/i.test(insert.error.message ?? '')) {
        insert = await admin
          .from(CRM_QUOTATIONS_TABLE)
          .insert({ ...payload, status: 'draft' })
          .select('id')
          .single();
      }

      if (insert.error || !insert.data?.id) {
        return {
          ok: false,
          quoteId: null,
          leadId: null,
          clientId,
          created: false,
          error: insert.error?.message || 'تعذر إنشاء عرض السعر بدون طلب مرتبط.',
        };
      }

      const quoteId = String(insert.data.id);
      const { title } = await enrichAndActivateQuotationFromDna(admin, quoteId, dna);

      await insertDnaQuoteTeamNotifications({
        clientId,
        clientName: dna.name,
        leadId: null,
        quoteId,
      });

      revalidatePath('/crm/quotations');
      revalidatePath('/crm');
      return buildSuccessPayload({
        quoteId,
        leadId: null,
        clientId,
        created: true,
        dna,
        title,
        origin: input.origin,
      });
    }

    let created = false;
    let quoteId = await fetchQuotationIdByLeadIdAdmin(leadId);
    if (!quoteId) {
      quoteId = await convertLeadToQuotationAdmin(leadId);
      created = true;

      const { data: leadRow } = await admin
        .from('leads')
        .select('destinations, travel_date, travel_days, expert_id, assigned_expert_id, full_name')
        .eq('id', leadId)
        .maybeSingle();

      if (leadRow) {
        const expertId = String(
          (leadRow as { expert_id?: unknown; assigned_expert_id?: unknown }).expert_id ??
            (leadRow as { assigned_expert_id?: unknown }).assigned_expert_id ??
            '',
        ).trim();
        if (expertId) {
          await admin
            .from(CRM_QUOTATIONS_TABLE)
            .update({ expert_id: expertId })
            .eq('id', quoteId)
            .then(({ error }) => {
              if (error && !/column|schema cache|does not exist/i.test(error.message ?? '')) {
                console.warn('[autoQuotationAfterDna] enrich expert:', error.message);
              }
            });
        }
      }
    }

    const { title } = await enrichAndActivateQuotationFromDna(admin, quoteId, dna);

    await insertDnaQuoteTeamNotifications({
      clientId,
      clientName: dna.name,
      leadId,
      quoteId,
    });

    revalidatePath('/crm/quotations');
    revalidatePath(`/crm/quotations/${quoteId}`);
    revalidatePath('/crm/pipeline');
    revalidatePath('/crm');

    return buildSuccessPayload({
      quoteId,
      leadId,
      clientId,
      created,
      dna,
      title,
      origin: input.origin,
    });
  } catch (err) {
    console.error('[autoCreateQuotationAfterDnaAdmin]', err);
    return {
      ok: false,
      quoteId: null,
      leadId: String(input.leadId ?? '').trim() || null,
      clientId,
      created: false,
      error: err instanceof Error ? err.message : 'تعذر إنشاء عرض السعر آلياً بعد DNA.',
    };
  }
}
