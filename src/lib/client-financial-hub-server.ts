import 'server-only';

import {
  buildInvoicePublicUrl,
  isInvoiceReceivableStatus,
  mapInvoiceRow,
} from '@/lib/crm-invoices';
import type {
  ClientFinancialHubData,
  ClientFinancialItineraryLink,
  ClientFinancialQuoteSummary,
} from '@/lib/client-financial-hub';
import { CRM_INVOICES_TABLE, CRM_QUOTATIONS_TABLE } from '@/lib/crm-invoices-server';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  QUOTATION_STATUS_LABEL,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

export async function fetchClientFinancialHubAdmin(
  clientIdRaw: string,
): Promise<ClientFinancialHubData | null> {
  const clientId = String(clientIdRaw ?? '').trim();
  if (!clientId) return null;

  const admin = createSupabaseAdminClient();
  const clientDbId = coerceQuotationIdForDb(clientId);

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, name, sales_stage, phone_wa')
    .eq('id', clientDbId)
    .maybeSingle();

  if (clientError || !client) return null;

  const clientRecord = client as Record<string, unknown>;
  const clientName = String(clientRecord.name ?? '').trim() || '—';
  const salesStage = String(clientRecord.sales_stage ?? '').trim();
  const clientPhone = String(clientRecord.phone_wa ?? '').trim() || null;

  const { data: quoteRows } = await admin
    .from(CRM_QUOTATIONS_TABLE)
    .select('*')
    .eq('client_id', clientDbId)
    .order('created_at', { ascending: false });

  const quotations: ClientFinancialQuoteSummary[] = (quoteRows ?? []).map((raw) => {
    const row = mapQuotationRow(raw as Record<string, unknown>);
    const totalBudget = quotationTotalPrice(row);
    const paidAmount = row.paid_amount;
    const remainingAmount =
      row.remaining_amount > 0 ? row.remaining_amount : Math.max(0, totalBudget - paidAmount);
    return {
      id: row.id,
      title: row.title || 'عرض سعر',
      status: row.status,
      statusLabel: QUOTATION_STATUS_LABEL[row.status] ?? row.status,
      totalBudget: roundMoney(totalBudget),
      paidAmount: roundMoney(paidAmount),
      remainingAmount: roundMoney(remainingAmount),
      tripCategory: row.trip_category,
      editUrl: `/crm/quotations/edit/${encodeURIComponent(row.id)}`,
    };
  });

  const { data: invoiceRows } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .eq('client_id', clientDbId)
    .order('created_at', { ascending: false });

  const invoices = (invoiceRows ?? []).map((row) => {
    const inv = mapInvoiceRow(row as Record<string, unknown>);
    inv.client_name = clientName;
    inv.client_phone = clientPhone;
    if (!inv.trip_title) {
      const q = quotations.find((qt) => qt.id === inv.quote_id);
      if (q) inv.trip_title = q.title;
    }
    return inv;
  });

  const { data: itineraryRows } = await admin
    .from('itineraries')
    .select('id, title, magic_link_id, quote_id, trip_type, group_name')
    .eq('client_id', clientDbId)
    .or('is_template.is.null,is_template.eq.false')
    .order('id', { ascending: false });

  const itineraries: ClientFinancialItineraryLink[] = (itineraryRows ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const id = String(row.id ?? '');
    const slug = String(row.magic_link_id ?? row.id ?? '').trim() || id;
    const title =
      String(row.title ?? '').trim() ||
      String(row.group_name ?? '').trim() ||
      `مسار #${id}`;
    const quoteId = row.quote_id != null ? String(row.quote_id) : null;
    return {
      id,
      title,
      slug,
      quoteId,
      tripType: String(row.trip_type ?? 'Individual'),
      viewUrl: `/itinerary/${encodeURIComponent(slug)}`,
    };
  });

  const paid = roundMoney(
    invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
  );
  const pendingInvoices = roundMoney(
    invoices.filter((i) => isInvoiceReceivableStatus(i.status)).reduce((sum, i) => sum + i.amount, 0),
  );
  const remaining = roundMoney(
    quotations.reduce((sum, q) => sum + q.remainingAmount, 0),
  );

  return {
    clientId,
    clientName,
    salesStage,
    totals: { paid, remaining, pendingInvoices },
    quotations,
    invoices,
    itineraries,
  };
}

export function invoicePublicLink(invoiceId: string): string {
  return buildInvoicePublicUrl(invoiceId);
}

export type { ClientFinancialHubData } from '@/lib/client-financial-hub';
