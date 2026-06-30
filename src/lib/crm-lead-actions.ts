import type { SupabaseClient } from '@supabase/supabase-js';

import { buildClientInsertPayload } from '@/lib/clientsTravelDna';
import type { CrmLeadRow } from '@/lib/crm-leads';

export function formatWhatsAppPhone(phone: string): string {
  return phone.replace(/[\s+\-()]/g, '');
}

export function whatsAppHref(phone: string): string {
  return `https://wa.me/${formatWhatsAppPhone(phone)}`;
}

export function quoteErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message?.trim();
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return 'خطأ غير معروف';
}

function addDaysIso(isoDate: string, days: number): string {
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
  const phone = phoneRaw.trim();
  if (!phone) return null;

  const normalized = formatWhatsAppPhone(phone);
  const candidates = [phone, normalized].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const value of candidates) {
    const byWa = await supabase.from('clients').select('id').eq('phone_wa', value).maybeSingle();
    if (byWa.data?.id != null) return Number(byWa.data.id);

    const byPhone = await supabase.from('clients').select('id').eq('phone', value).maybeSingle();
    if (!byPhone.error && byPhone.data?.id != null) return Number(byPhone.data.id);
  }

  return null;
}

async function createClientFromLead(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
): Promise<number> {
  const phone = lead.phone_wa.trim();
  const payload = buildClientInsertPayload({
    name: lead.full_name.trim(),
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

  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert(payload)
    .select('id')
    .single();

  if (clientError || !newClient?.id) {
    console.error('Quote Creation Error:', clientError);
    throw clientError ?? new Error('تعذر إنشاء ملف العميل في CRM.');
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

async function resolveClientIdForLead(
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
    lead_source: 'trip_log',
    lead_id: lead.id,
    ...(lead.referral_code?.trim() ? { referral_code: lead.referral_code.trim() } : {}),
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
    .select('id')
    .single();

  if (error?.message?.includes('lead_id') && error.message.includes('column')) {
    const { lead_id: _drop, ...withoutLeadId } = fullPayload;
    const retry = await supabase
      .from('quotations')
      .insert([withoutLeadId as never])
      .select('id')
      .single();
    if (retry.error) {
      console.error('Quote Creation Error:', retry.error);
      throw retry.error;
    }
    return String(retry.data.id);
  }

  if (error) {
    console.error('Quote Creation Error:', error);
    throw error;
  }

  return String(data.id);
}

async function markLeadConverted(supabase: SupabaseClient, leadId: string): Promise<void> {
  const { error: convertedError } = await supabase
    .from('leads')
    .update({ status: 'converted' })
    .eq('id', leadId);

  if (!convertedError) return;

  console.error('Quote Creation Error:', convertedError);

  const { error: processingError } = await supabase
    .from('leads')
    .update({ status: 'processing' })
    .eq('id', leadId);

  if (processingError) {
    console.error('Quote Creation Error:', processingError);
    throw processingError;
  }
}

export async function deleteCrmLead(supabase: SupabaseClient, leadId: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) throw error;
}

export async function convertLeadToQuotation(
  supabase: SupabaseClient,
  lead: CrmLeadRow,
): Promise<string> {
  try {
    const clientId = await resolveClientIdForLead(supabase, lead);
    const quoteId = await insertQuotationForLead(supabase, lead, clientId);
    await markLeadConverted(supabase, lead.id);
    return quoteId;
  } catch (error) {
    console.error('Quote Creation Error:', error);
    throw error;
  }
}
