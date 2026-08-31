'use server';

import { mapQuotationRow, normalizeQuotationId, type QuotationRow } from '@/lib/crm-quotations';
import { createItineraryFromApprovedQuotation } from '@/lib/quotation-to-itinerary';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type EnsureKanbanItineraryResult =
  | { ok: true; itineraryId: string; quoteId: string | null; source: 'quotation' | 'lead' }
  | { ok: false; error: string };

const QUOTE_DEEP_SELECT =
  '*, clients(id, name, phone_wa), lead:leads(id, full_name, phone_wa, destinations, client_id, travel_date)';

function coerceClientId(raw: unknown): string | number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return s;
}

async function deepFetchLead(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  leadId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();
  if (error) {
    console.warn('[kanban-itinerary] lead deep fetch:', error.message);
    return null;
  }
  return (data as Record<string, unknown> | null) ?? null;
}

async function deepFetchQuotation(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  opts: {
    leadId?: string | null;
    clientId?: string | number | null;
    quoteId?: string | null;
  },
): Promise<QuotationRow | null> {
  const trySelect = async (
    column: string,
    value: string | number,
  ): Promise<Record<string, unknown> | null> => {
    let { data, error } = await admin
      .from('quotations')
      .select(QUOTE_DEEP_SELECT)
      .eq(column, value)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const plain = await admin
        .from('quotations')
        .select('*')
        .eq(column, value)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = plain.data;
      error = plain.error;
    }

    if (error || !data) return null;
    return data as Record<string, unknown>;
  };

  const quoteId = normalizeQuotationId(opts.quoteId ?? '');
  if (quoteId) {
    const row = await trySelect('id', quoteId);
    if (row) return mapQuotationRow(row);
  }

  const leadId = String(opts.leadId ?? '').trim();
  if (leadId) {
    const row = await trySelect('lead_id', leadId);
    if (row) return mapQuotationRow(row);
  }

  const clientId = coerceClientId(opts.clientId);
  if (clientId != null) {
    const variants: Array<string | number> = [clientId];
    if (typeof clientId === 'number') variants.push(String(clientId));
    else if (/^\d+$/.test(String(clientId))) variants.push(Number(clientId));

    for (const variant of variants) {
      const row = await trySelect('client_id', variant);
      if (row) return mapQuotationRow(row);
    }
  }

  return null;
}

/** Merge missing quote fields from the deep-fetched lead (shallow card → full record). */
function enrichQuotationFromLead(
  quotation: QuotationRow,
  lead: Record<string, unknown> | null,
): QuotationRow {
  const next = { ...quotation };

  if (!next.client_id && next.clients?.id != null) {
    next.client_id = String(next.clients.id);
  }

  if (lead) {
    if (!next.client_id && lead.client_id != null) {
      next.client_id = String(lead.client_id);
    }
    if (!next.destinations.length && Array.isArray(lead.destinations)) {
      next.destinations = (lead.destinations as unknown[])
        .map((d) => String(d ?? '').trim())
        .filter(Boolean);
    }
    if (!next.start_date && lead.travel_date) {
      next.start_date = String(lead.travel_date).slice(0, 10);
      next.end_date = next.end_date || next.start_date;
    }
    if ((!next.clients?.name || next.clients.name === '—') && lead.full_name) {
      next.clients = {
        ...(next.clients ?? {}),
        id: next.clients?.id,
        name: String(lead.full_name).trim() || null,
        phone_wa: next.clients?.phone_wa ?? null,
      };
    }
  }

  return next;
}

/**
 * Kanban → Routes handoff via service_role.
 * Always deep-fetches lead + quotation before INSERT (never trusts shallow card state).
 */
export async function ensureKanbanItineraryAction(input: {
  leadId: string;
  clientId?: string | number | null;
  quoteId?: string | null;
}): Promise<EnsureKanbanItineraryResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const leadId = String(input.leadId ?? '').trim();
  if (!leadId) return { ok: false, error: 'معرّف الطلب (lead) غير صالح.' };

  try {
    const admin = createSupabaseAdminClient();

    // 1) DEEP FETCH lead (Kanban card id is leads.id — never insert from card props alone)
    const lead = await deepFetchLead(admin, leadId);
    const clientId =
      coerceClientId(input.clientId) ??
      coerceClientId(lead?.client_id) ??
      null;

    // 2) DEEP FETCH quotation linked to this lead / client
    let quotation = await deepFetchQuotation(admin, {
      leadId,
      clientId,
      quoteId: input.quoteId,
    });

    if (quotation) {
      quotation = enrichQuotationFromLead(quotation, lead);

      if (!quotation.client_id) {
        return {
          ok: false,
          error:
            'عرض السعر موجود لكن بدون client_id — اربط العميل بالعرض ثم أعد توليد المسار.',
        };
      }

      const created = await createItineraryFromApprovedQuotation(quotation, admin, {
        throwOnError: true,
        forceBackfill: true,
      });
      if (!created?.itineraryId) {
        return { ok: false, error: 'تعذر إنشاء المسار من عرض السعر.' };
      }

      // 3) Verify relational fields actually persisted
      const verify = await admin
        .from('itineraries')
        .select('id, client_id, expert_id, start_date, flight_details, customer_name')
        .eq('id', created.itineraryId)
        .maybeSingle();

      const row = verify.data as Record<string, unknown> | null;
      if (!row?.client_id) {
        // Force-patch client_id if insert stripped it
        const patch = await admin
          .from('itineraries')
          .update({
            client_id: coerceClientId(quotation.client_id),
            customer_name:
              String(row?.customer_name ?? '').trim() ||
              String(quotation.clients?.name ?? '').trim() ||
              null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', created.itineraryId)
          .select('id, client_id')
          .maybeSingle();

        if (!patch.data?.client_id) {
          return {
            ok: false,
            error:
              'تم إنشاء المسار لكن client_id لم يُحفظ (تحقق من RLS/عمود client_id).',
          };
        }
      }

      return {
        ok: true,
        itineraryId: String(created.itineraryId),
        quoteId: normalizeQuotationId(quotation.id) || null,
        source: 'quotation',
      };
    }

    // 4) No quotation — build from deep-fetched lead via shared helper
    const { ensureItineraryOnPaymentConfirmed } = await import(
      '@/lib/quotation-to-itinerary'
    );
    const fromLead = await ensureItineraryOnPaymentConfirmed(admin, {
      leadId,
      clientId,
    });

    return {
      ok: true,
      itineraryId: String(fromLead.itineraryId),
      quoteId: null,
      source: 'lead',
    };
  } catch (err) {
    console.error('[ensureKanbanItineraryAction]', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر توليد المسار.',
    };
  }
}
