import type { SupabaseClient } from '@supabase/supabase-js';

import { buildClientInsertPayload } from '@/lib/clientsTravelDna';
import { assertUsableLeadClientFields, buildPhoneLookupCandidates, canonicalizePhoneWa, isUsableClientPhone } from '@/lib/client-intake-pipeline';
import {
  createEmptyActivityProposal,
  createEmptyFlightProposal,
  createEmptyHotelProposal,
  createEmptyTransportProposal,
  normalizeQuotationId,
  type QuotationRow,
} from '@/lib/crm-quotations';
import {
  createEmptyActivityOption,
  createEmptyCostLine,
  createEmptyHotelOption,
  createEmptyItineraryDay,
  createEmptyTransportOption,
  emptyClientFeedback,
} from '@/lib/interactive-quotation';
import type { CrmLeadRow } from '@/lib/crm-leads';
import { updatePipelineStatus } from '@/lib/lead-pipeline-automation';

export function formatWhatsAppPhone(phone: string): string {
  return canonicalizePhoneWa(String(phone ?? '').trim());
}

export function whatsAppHref(phone: string): string {
  const digits = formatWhatsAppPhone(phone);
  if (digits.length >= 8) {
    return `https://wa.me/${digits}`;
  }
  return 'https://wa.me/';
}

export function whatsAppHrefWithMessage(phone: string, text: string): string {
  const encoded = encodeURIComponent(String(text ?? '').trim());
  const digits = formatWhatsAppPhone(phone);
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function quoteErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message?.trim();
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return 'خطأ غير معروف';
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString('en-CA');
  }
  d.setDate(d.getDate() + Math.max(0, days));
  return d.toLocaleDateString('en-CA');
}

function defaultStartDate(lead: CrmLeadRow): string {
  if (lead.travel_date?.trim()) return lead.travel_date.trim();
  return new Date().toLocaleDateString('en-CA');
}

async function findClientByPhone(
  supabase: SupabaseClient,
  phoneRaw: string,
): Promise<number | null> {
  if (!isUsableClientPhone(phoneRaw)) return null;
  const phone = phoneRaw.trim();
  if (!phone) return null;

  const candidates = Array.from(
    new Set(
      [
        ...buildPhoneLookupCandidates(phone),
        ...buildPhoneLookupCandidates(canonicalizePhoneWa(phone) || phone),
        formatWhatsAppPhone(phone),
      ].filter(Boolean),
    ),
  );

  for (const value of candidates) {
    const byWa = await supabase.from('clients').select('id').eq('phone_wa', value).maybeSingle();
    if (!byWa.error && byWa.data?.id != null) return Number(byWa.data.id);
  }

  const last9 = canonicalizePhoneWa(phone).slice(-9);
  if (last9.length === 9) {
    const fuzzy = await supabase
      .from('clients')
      .select('id, phone_wa')
      .ilike('phone_wa', `%${last9}`)
      .limit(8);
    if (!fuzzy.error && fuzzy.data?.length) {
      for (const row of fuzzy.data) {
        const a = canonicalizePhoneWa(String((row as { phone_wa?: unknown }).phone_wa ?? ''));
        if (a.slice(-9) === last9) {
          const id = Number((row as { id?: unknown }).id);
          if (Number.isFinite(id) && id > 0) return id;
        }
      }
    }
  }

  return null;
}

async function createClientFromLead(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
): Promise<number> {
  const { name, phone } = assertUsableLeadClientFields({
    name: lead.full_name,
    phone: lead.phone_wa,
  });
  const payload = buildClientInsertPayload({
    name,
    phone_wa: phone,
    email: lead.email?.trim() || '',
    birth_date: '',
    flight_seat: '',
    food_allergies: '',
    favorite_drink: '',
    hotel_preference: '',
    secret_notes: '',
    client_type: 'عميل',
    is_influencer: false,
    client_tier: 'regular',
    total_trips: 0,
    referrals_count: 0,
  });

  delete (payload as Record<string, unknown>).lead_source;
  // clients schema uses phone_wa only — never write `phone`

  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert(payload)
    .select('id')
    .single();

  if (clientError || !newClient?.id) {
    console.error('Quote Creation Error:', clientError);
    const e = clientError as { message?: string; details?: string; hint?: string; code?: string } | null;
    const detail = [e?.message, e?.details, e?.hint, e?.code ? `code=${e.code}` : '']
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' | ');

    // unique_phone_wa → reclaim existing client (smart recognition)
    if (/duplicate|unique|23505|unique_phone_wa/i.test(detail)) {
      const raced = await findClientByPhone(supabase, phone);
      if (raced != null) return raced;
    }

    throw new Error(detail || 'تعذر إنشاء ملف العميل في CRM.');
  }

  const refCode = lead.referral_code?.trim();
  if (refCode) {
    await supabase
      .from('clients')
      .update({ used_code: refCode })
      .eq('id', newClient.id)
      .then(({ error }) => {
        if (error) console.warn('[crm-lead-actions] used_code update:', error.message);
      });
  }

  await supabase
    .from('client_preferences')
    .insert({ client_id: newClient.id })
    .then(({ error }) => {
      if (error) console.warn('[crm-lead-actions] client_preferences insert:', error.message);
    });

  return Number(newClient.id);
}

export async function resolveClientIdForLead(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
): Promise<number> {
  const existingId = await findClientByPhone(supabase, lead.phone_wa);
  if (existingId != null) return existingId;
  return createClientFromLead(supabase, lead);
}

function buildQuotationInsertPayload(lead: CrmLeadRow, clientId: number) {
  const startDate = defaultStartDate(lead);
  const endDate = addDaysIso(startDate, Math.max(1, lead.travel_days) - 1);
  const destinations = Array.isArray(lead.destinations) ? [...lead.destinations] : [];
  const expertId = String(
    (lead as { expert_id?: unknown; assigned_expert_id?: unknown }).expert_id ??
      (lead as { assigned_expert_id?: unknown }).assigned_expert_id ??
      '',
  ).trim();

  return {
    client_id: clientId,
    title: `عرض سعر - ${lead.full_name.trim()}`,
    destinations,
    start_date: startDate,
    end_date: endDate,
    total_estimated_cost: 0,
    expected_profit: 0,
    status: 'draft' as const,
    flight_proposals: [] as const,
    hotel_proposals: [] as const,
    activities: [] as const,
    transportation: [] as const,
    lead_source: 'trip_log',
    lead_id: lead.id,
    ...(lead.referral_code?.trim() ? { referral_code: lead.referral_code.trim() } : {}),
    ...(expertId ? { expert_id: expertId } : {}),
  };
}

async function insertQuotationForLead(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
  clientId: number,
): Promise<string> {
  const fullPayload = buildQuotationInsertPayload(lead, clientId);

  const { data, error } = await supabase
    .from('quotations')
    .insert([fullPayload as never])
    .select('id, lead_id')
    .single();

  if (error?.message?.includes('lead_id') && error.message.includes('column')) {
    const { lead_id: _drop, ...withoutLeadId } = fullPayload;
    const retry = await supabase
      .from('quotations')
      .insert([withoutLeadId as never])
      .select('id, lead_id')
      .single();
    if (retry.error) {
      // Retry without optional expert_id if column missing
      if (/expert_id|column|schema cache/i.test(retry.error.message ?? '')) {
        const { expert_id: _e, ...lean } = withoutLeadId as Record<string, unknown>;
        const leanRetry = await supabase
          .from('quotations')
          .insert([lean as never])
          .select('id, lead_id')
          .single();
        if (leanRetry.error) {
          console.error('Quote Creation Error:', leanRetry.error);
          throw leanRetry.error;
        }
        return assertInsertedQuotationId(leanRetry.data, lead.id);
      }
      console.error('Quote Creation Error:', retry.error);
      throw retry.error;
    }
    return assertInsertedQuotationId(retry.data, lead.id);
  }

  if (error && /expert_id|column|schema cache/i.test(error.message ?? '')) {
    const { expert_id: _e, ...withoutExpert } = fullPayload as Record<string, unknown>;
    const retry = await supabase
      .from('quotations')
      .insert([withoutExpert as never])
      .select('id, lead_id')
      .single();
    if (retry.error) {
      console.error('Quote Creation Error:', retry.error);
      throw retry.error;
    }
    return assertInsertedQuotationId(retry.data, lead.id);
  }

  if (error) {
    console.error('Quote Creation Error:', error);
    throw error;
  }

  return assertInsertedQuotationId(data, lead.id);
}

function assertInsertedQuotationId(
  row: { id?: unknown; lead_id?: unknown } | null,
  leadId: string,
): string {
  const quotationId = normalizeQuotationId(row?.id);
  if (!quotationId) {
    throw new Error('تعذر استخراج معرّف عرض السعر بعد الإنشاء.');
  }
  const linkedLeadId = normalizeQuotationId(row?.lead_id);
  const needleLeadId = normalizeQuotationId(leadId);
  if (linkedLeadId && quotationId === linkedLeadId) {
    throw new Error('تعارض معرّفات: quotations.id يطابق lead_id.');
  }
  if (needleLeadId && quotationId === needleLeadId) {
    throw new Error('تعارض معرّفات: تم إرجاع lead.id بدلاً من quotations.id.');
  }
  return quotationId;
}

/** After a quotation is created from a lead → Kanban `quote_stage` (not legacy `converted`) */
export async function markCrmLeadConverted(supabase: SupabaseClient, leadId: string): Promise<void> {
  try {
    await updatePipelineStatus(supabase, { leadId, force: true }, 'quote_stage');
  } catch (err) {
    console.error('Quote Creation Error:', err);
    const { error: processingError } = await supabase
      .from('leads')
      .update({ status: 'quote_stage' })
      .eq('id', leadId);
    if (processingError) {
      console.error('Quote Creation Error:', processingError);
      throw processingError;
    }
  }
}

export async function deleteCrmLead(supabase: SupabaseClient, leadId: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) throw error;
}

/** يحوّل صف leads إلى مسودة عرض سعر (قبل الإدراج في quotations) */
export function mapLeadRowToQuotationDraft(
  lead: CrmLeadRow | Record<string, unknown>,
  client?: { id?: number; name?: string | null; phone_wa?: string | null } | null,
): QuotationRow {
  const fullName = String(lead.full_name ?? '').trim();
  const startDate = defaultStartDate(lead as CrmLeadRow);
  const travelDays = Math.max(1, Number(lead.travel_days) || 1);
  const endDate = addDaysIso(startDate, travelDays - 1);
  const destinations = Array.isArray(lead.destinations)
    ? (lead.destinations as string[]).filter(Boolean)
    : [];
  const clientId =
    client?.id != null
      ? String(client.id)
      : lead.client_id != null && lead.client_id !== ''
        ? normalizeQuotationId(lead.client_id)
        : null;

  return {
    id: '',
    client_id: clientId,
    lead_id: normalizeQuotationId(lead.id) || null,
    title: fullName ? `عرض سعر - ${fullName}` : 'عرض سعر جديد',
    destinations,
    start_date: startDate,
    end_date: endDate,
    total_estimated_cost: 0,
    expected_profit: 0,
    status: 'draft',
    paid_amount: 0,
    remaining_amount: 0,
    trip_category: 'private',
    flight_proposals: [createEmptyFlightProposal()],
    hotel_proposals: [createEmptyHotelProposal()],
    activities_proposals: [createEmptyActivityProposal()],
    transport_proposals: [createEmptyTransportProposal()],
    profit_margin: 20,
    service_fee: 0,
    grand_total: 0,
    lead_source: 'trip_log',
    referral_code:
      lead.referral_code != null ? String(lead.referral_code).trim() || null : null,
    is_referral_paid: false,
    expert_name: null,
    expert_id: null,
    created_at: String(lead.created_at ?? ''),
    itinerary_days: [createEmptyItineraryDay(1)],
    hotel_options: [createEmptyHotelOption()],
    transport_options: [createEmptyTransportOption()],
    activity_options: [createEmptyActivityOption()],
    cost_breakdown: [createEmptyCostLine()],
    client_feedback: emptyClientFeedback(),
    clients: client
      ? {
          id: client.id,
          name: client.name ?? fullName,
          phone_wa: (client.phone_wa ?? String(lead.phone_wa ?? '').trim()) || null,
        }
      : fullName
        ? {
            name: fullName,
            phone_wa: String(lead.phone_wa ?? '').trim() || null,
          }
        : null,
  };
}

export async function convertLeadToQuotation(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
): Promise<string> {
  try {
    const clientId = await resolveClientIdForLead(supabase, lead);
    const quoteId = await insertQuotationForLead(supabase, lead, clientId);
    await markCrmLeadConverted(supabase, lead.id);
    return quoteId;
  } catch (error) {
    console.error('Quote Creation Error:', error);
    throw error;
  }
}
