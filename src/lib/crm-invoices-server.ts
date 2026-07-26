import 'server-only';

import {
  buildInvoiceLedger,
  buildQuoteLedger,
  INVOICE_RECEIVABLE_DB_STATUSES,
  isInvoiceReceivableStatus,
  mapInvoiceRow,
  type InvoiceLedgerSummary,
  type InvoiceRow,
  type InvoiceType,
  type QuoteLedgerSummary,
} from '@/lib/crm-invoices';
import { setLeadPipelineStatus } from '@/lib/lead-pipeline-automation';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  normalizeQuotationId,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runInvoicePaymentCascade } from '@/lib/invoice-payment-cascade';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CRM_INVOICES_TABLE = 'invoices' as const;
export const CRM_QUOTATIONS_TABLE = 'quotations' as const;

function formatSupabaseDbError(
  error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined,
  fallback = 'تعذر تنفيذ العملية على جدول invoices.',
): string {
  if (!error) return fallback;
  const parts = [error.message, error.details, error.hint, error.code ? `(${error.code})` : '']
    .filter(Boolean)
    .join(' — ');
  return parts || fallback;
}

function quoteIdVariants(quoteId: string): string[] {
  const key = normalizeQuotationId(quoteId);
  if (!key) return [];
  const variants = new Set<string>([key]);
  const coerced = coerceQuotationIdForDb(key);
  variants.add(String(coerced));
  return [...variants];
}

export type CreateInvoiceInput = {
  clientId: string | number | null;
  quoteId: string;
  /** للعرض في الواجهة فقط — لا يُحفظ في جدول invoices */
  tripTitle?: string;
  amount: number;
  type: InvoiceType;
};

export async function createInvoiceAdmin(input: CreateInvoiceInput): Promise<InvoiceRow> {
  const quoteId = normalizeQuotationId(input.quoteId);
  if (!quoteId) throw new Error('معرّف العرض غير صالح.');

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('المبلغ يجب أن يكون أكبر من صفر.');
  }

  const type: InvoiceType = input.type === 'full' ? 'full' : 'deposit';
  const clientIdRaw = input.clientId;
  let clientId: number | null = null;
  if (clientIdRaw != null && clientIdRaw !== '') {
    const n = Number(coerceQuotationIdForDb(clientIdRaw));
    if (Number.isFinite(n) && n > 0) clientId = n;
  }

  const admin = createSupabaseAdminClient();

  const quoteVariants = [quoteId, coerceQuotationIdForDb(quoteId)];
  const { data: quoteRow, error: quoteLookupError } = await admin
    .from(CRM_QUOTATIONS_TABLE)
    .select('id, client_id, title')
    .in('id', quoteVariants)
    .limit(1)
    .maybeSingle();

  if (quoteLookupError) {
    throw new Error(formatSupabaseDbError(quoteLookupError, 'تعذر التحقق من عرض السعر.'));
  }
  if (!quoteRow) {
    throw new Error(
      'يجب حفظ عرض السعر في قاعدة البيانات قبل إصدار الفاتورة. افتح العرض واحفظه ثم أعد المحاولة.',
    );
  }

  const persistedQuoteId = normalizeQuotationId((quoteRow as { id?: unknown }).id);
  if (!persistedQuoteId) {
    throw new Error('معرّف عرض السعر المحفوظ غير صالح.');
  }

  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .insert({
      client_id: clientId,
      quote_id: persistedQuoteId,
      amount,
      type,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(formatSupabaseDbError(error, 'تعذر إنشاء الفاتورة.'));
  }

  const invoice = mapInvoiceRow(data as Record<string, unknown>);
  const tripTitle = input.tripTitle?.trim();
  if (tripTitle) invoice.trip_title = tripTitle;

  await syncQuotationAfterInvoiceIssued(admin, persistedQuoteId);

  return invoice;
}

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/** بعد إصدار فاتورة: حالة بانتظار الدفع + المتبقي على العرض */
async function syncQuotationAfterInvoiceIssued(
  admin: SupabaseClient,
  quoteId: string,
): Promise<void> {
  const { totalCost } = await fetchQuotationCostForLedger(admin, quoteId);
  const paidAmount = await sumPaidInvoicesForQuoteAdmin(quoteId);
  const remainingAmount = roundMoney(Math.max(0, totalCost - paidAmount));
  const updatedAt = new Date().toISOString();

  const payloads: Record<string, unknown>[] = [
    {
      status: 'awaiting_payment',
      remaining_amount: remainingAmount,
      updated_at: updatedAt,
    },
    {
      status: 'approved',
      remaining_amount: remainingAmount,
      updated_at: updatedAt,
    },
  ];

  for (const payload of payloads) {
    const { error } = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .update(payload)
      .eq('id', coerceQuotationIdForDb(quoteId));
    if (!error) {
      const { data: qrow } = await admin
        .from(CRM_QUOTATIONS_TABLE)
        .select('lead_id, client_id')
        .eq('id', coerceQuotationIdForDb(quoteId))
        .maybeSingle();
      const leadId = (qrow as { lead_id?: string | null } | null)?.lead_id ?? null;
      const clientId = (qrow as { client_id?: string | number | null } | null)?.client_id ?? null;
      await setLeadPipelineStatus(admin, { leadId, clientId }, 'awaiting_payment').catch((err) => {
        console.warn('[invoices-admin] lead pipeline awaiting_payment:', err);
      });
      return;
    }
    console.warn('[invoices-admin] quotation status sync:', error.message);
  }
}

export async function fetchInvoicesForQuoteAdmin(quoteId: string): Promise<InvoiceRow[]> {
  const variants = quoteIdVariants(quoteId);
  if (!variants.length) return [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .in('quote_id', variants)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[invoices-admin] list:', formatSupabaseDbError(error));
    return [];
  }

  return (data ?? []).map((row) => mapInvoiceRow(row as Record<string, unknown>));
}

export async function fetchPendingInvoiceForClientQuoteAdmin(
  clientId: string | number,
  quoteId: string,
): Promise<InvoiceRow | null> {
  const clientDbId = coerceQuotationIdForDb(clientId);
  const variants = quoteIdVariants(quoteId);
  if (!variants.length) return null;

  const admin = createSupabaseAdminClient();
  const { data: receivableRaw, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .eq('client_id', clientDbId)
    .in('status', [...INVOICE_RECEIVABLE_DB_STATUSES])
    .in('quote_id', variants)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !receivableRaw) return null;
  if (!isInvoiceReceivableStatus((receivableRaw as { status?: unknown }).status)) return null;
  return mapInvoiceRow(receivableRaw as Record<string, unknown>);
}

export async function fetchInvoiceByIdAdmin(id: string): Promise<InvoiceRow | null> {
  const key = String(id ?? '').trim();
  if (!key) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .eq('id', key)
    .maybeSingle();

  if (error) {
    console.error('[invoices-admin] fetch:', formatSupabaseDbError(error));
    return null;
  }
  if (!data) return null;

  const invoice = mapInvoiceRow(data as Record<string, unknown>);

  if (invoice.client_id) {
    const { data: client } = await admin
      .from('clients')
      .select('id, name, phone_wa')
      .eq('id', coerceQuotationIdForDb(invoice.client_id))
      .maybeSingle();

    if (client) {
      const record = client as Record<string, unknown>;
      invoice.client_name = String(record.name ?? '').trim() || null;
      invoice.client_phone = String(record.phone_wa ?? '').trim() || null;
    }
  }

  if (!invoice.trip_title && invoice.quote_id) {
    const { tripTitle } = await fetchQuotationCostForLedger(admin, invoice.quote_id);
    invoice.trip_title = tripTitle;
  }

  return invoice;
}

export async function markInvoicePaidAdmin(id: string): Promise<InvoiceRow> {
  const key = String(id ?? '').trim();
  if (!key) throw new Error('معرّف الفاتورة غير صالح.');

  const admin = createSupabaseAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('*')
    .eq('id', key)
    .maybeSingle();

  if (fetchError) {
    throw new Error(formatSupabaseDbError(fetchError, 'تعذر قراءة الفاتورة.'));
  }
  if (!existing) {
    throw new Error('لم يُعثر على الفاتورة.');
  }

  const wasPaid = String((existing as { status?: unknown }).status ?? '') === 'paid';
  const invoiceRow = mapInvoiceRow(existing as Record<string, unknown>);

  if (wasPaid) {
    return invoiceRow;
  }

  const paidAt = new Date().toISOString();
  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .update({ status: 'paid', paid_at: paidAt, updated_at: paidAt })
    .eq('id', key)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseDbError(error, 'تعذر تحديث حالة الفاتورة.'));
  }
  if (!data) {
    throw new Error('لم يُعثر على الفاتورة.');
  }

  const invoice = mapInvoiceRow(data as Record<string, unknown>);

  await runInvoicePaymentCascade(admin, {
    id: invoice.id,
    quote_id: invoice.quote_id,
    client_id: invoice.client_id,
    amount: invoice.amount,
  });

  return invoice;
}

async function fetchQuotationCostForLedger(
  admin: SupabaseClient,
  quoteId: string,
): Promise<{ totalCost: number; tripTitle: string }> {
  const variants = quoteIdVariants(quoteId);
  for (const id of variants) {
    const { data, error } = await admin
      .from(CRM_QUOTATIONS_TABLE)
      .select('*')
      .eq('id', coerceQuotationIdForDb(id))
      .maybeSingle();

    if (error || !data) continue;
    const row = mapQuotationRow(data as Record<string, unknown>);
    return {
      totalCost: quotationTotalPrice(row),
      tripTitle: row.title || 'رحلة Wanderloom',
    };
  }
  return { totalCost: 0, tripTitle: 'رحلة Wanderloom' };
}

/** مجموع مبالغ الفواتير المدفوعة لعرض سعر (اختياري: استثناء فاتورة) */
export async function sumPaidInvoicesForQuoteAdmin(
  quoteId: string,
  options?: { excludeInvoiceId?: string },
): Promise<number> {
  const variants = quoteIdVariants(quoteId);
  if (!variants.length) return 0;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(CRM_INVOICES_TABLE)
    .select('id, amount, status, quote_id')
    .in('quote_id', variants)
    .eq('status', 'paid');

  if (error) {
    console.error('[invoices-admin] sum paid:', formatSupabaseDbError(error));
    return 0;
  }

  const exclude = String(options?.excludeInvoiceId ?? '').trim();
  let sum = 0;
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    if (exclude && String(record.id) === exclude) continue;
    const amount = Number(record.amount) || 0;
    if (amount > 0) sum += amount;
  }
  return Math.round(sum * 100) / 100;
}

/** دفتر مالي لعرض السعر — إجمالي / مدفوع / متبقي */
export async function fetchQuoteLedgerAdmin(
  quoteId: string,
  options?: { totalCostOverride?: number },
): Promise<QuoteLedgerSummary | null> {
  const key = normalizeQuotationId(quoteId);
  if (!key) return null;

  const admin = createSupabaseAdminClient();
  const { totalCost: dbTotal, tripTitle } = await fetchQuotationCostForLedger(admin, key);
  const totalCost =
    options?.totalCostOverride != null && Number.isFinite(options.totalCostOverride)
      ? Math.max(0, Number(options.totalCostOverride))
      : dbTotal;
  const paidAmount = await sumPaidInvoicesForQuoteAdmin(key);
  return buildQuoteLedger(key, tripTitle, totalCost, paidAmount);
}

/** دفتر مالي لصفحة فاتورة العميل */
export async function fetchInvoiceLedgerAdmin(
  invoiceId: string,
): Promise<{ invoice: InvoiceRow; ledger: InvoiceLedgerSummary } | null> {
  const invoice = await fetchInvoiceByIdAdmin(invoiceId);
  if (!invoice) return null;

  const admin = createSupabaseAdminClient();
  const { totalCost, tripTitle } = await fetchQuotationCostForLedger(admin, invoice.quote_id);
  const paidAmountAll = await sumPaidInvoicesForQuoteAdmin(invoice.quote_id);
  const paidBeforeCurrent = await sumPaidInvoicesForQuoteAdmin(invoice.quote_id, {
    excludeInvoiceId: invoice.id,
  });

  const ledger = buildInvoiceLedger({
    quoteId: invoice.quote_id,
    tripTitle: invoice.trip_title || tripTitle,
    totalCost: totalCost > 0 ? totalCost : invoice.amount,
    paidAmountAll,
    paidBeforeCurrent,
    currentInvoiceAmount: invoice.amount,
  });

  return { invoice, ledger };
}
