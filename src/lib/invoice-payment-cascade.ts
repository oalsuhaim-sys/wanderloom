import 'server-only';

import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  normalizeQuotationId,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { setLeadPipelineStatus } from '@/lib/lead-pipeline-automation';
import {
  SALES_STAGE_ACTIVE_TRAVELER,
  SALES_STAGE_CONFIRMED,
} from '@/lib/client-sales-stage';
import type { SupabaseClient } from '@supabase/supabase-js';

const INVOICES_TABLE = 'invoices';
const QUOTATIONS_TABLE = 'quotations';

export type QuotationPaymentStatus = 'deposit_paid' | 'fully_paid';

function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function quoteIdVariants(quoteId: string): string[] {
  const key = normalizeQuotationId(quoteId);
  if (!key) return [];
  const variants = new Set<string>([key]);
  variants.add(String(coerceQuotationIdForDb(key)));
  return [...variants];
}

async function sumPaidInvoicesForQuote(
  admin: SupabaseClient,
  quoteId: string,
): Promise<number> {
  const variants = quoteIdVariants(quoteId);
  if (!variants.length) return 0;

  const { data, error } = await admin
    .from(INVOICES_TABLE)
    .select('amount, status, quote_id')
    .in('quote_id', variants)
    .eq('status', 'paid');

  if (error) return 0;

  let sum = 0;
  for (const row of data ?? []) {
    const amount = Number((row as { amount?: unknown }).amount) || 0;
    if (amount > 0) sum += amount;
  }
  return roundMoney(sum);
}

async function fetchQuotationRecord(
  admin: SupabaseClient,
  quoteId: string,
): Promise<Record<string, unknown> | null> {
  const variants = quoteIdVariants(quoteId);
  for (const id of variants) {
    const { data, error } = await admin
      .from(QUOTATIONS_TABLE)
      .select('*')
      .eq('id', coerceQuotationIdForDb(id))
      .maybeSingle();
    if (!error && data) return data as Record<string, unknown>;
  }
  return null;
}

/**
 * بعد تحويل فاتورة إلى paid: يُحدّث عرض السعر والعميل في معاملة منطقية واحدة.
 * يعتمد مجموع الفواتير المدفوعة كمصدر حقيقة لتجنب الازدواجية.
 */
export async function runInvoicePaymentCascade(
  admin: SupabaseClient,
  invoice: {
    id: string;
    quote_id: string;
    client_id: string | null;
    amount: number;
  },
): Promise<void> {
  const quoteId = normalizeQuotationId(invoice.quote_id);
  if (!quoteId) return;

  const quoteRaw = await fetchQuotationRecord(admin, quoteId);
  if (!quoteRaw) {
    console.warn('[invoice-cascade] quotation not found:', quoteId);
    return;
  }

  const quote = mapQuotationRow(quoteRaw);
  const totalBudget = quotationTotalPrice(quote);
  const paidAmount = await sumPaidInvoicesForQuote(admin, quoteId);
  const remainingAmount = roundMoney(Math.max(0, totalBudget - paidAmount));

  const paymentStatus: QuotationPaymentStatus =
    totalBudget > 0 && paidAmount >= totalBudget ? 'fully_paid' : 'deposit_paid';

  const quoteUpdate: Record<string, unknown> = {
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    status: paymentStatus,
    updated_at: new Date().toISOString(),
  };

  const { error: quoteError } = await admin
    .from(QUOTATIONS_TABLE)
    .update(quoteUpdate)
    .eq('id', coerceQuotationIdForDb(quoteId));

  if (quoteError) {
    console.error('[invoice-cascade] quotation update:', quoteError.message);
    throw new Error(quoteError.message || 'تعذر تحديث عرض السعر بعد الدفع.');
  }

  if (!invoice.client_id) return;

  const clientStage =
    paymentStatus === 'fully_paid' ? SALES_STAGE_ACTIVE_TRAVELER : SALES_STAGE_CONFIRMED;

  const { error: clientError } = await admin
    .from('clients')
    .update({
      sales_stage: clientStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', coerceQuotationIdForDb(invoice.client_id));

  // Master pipeline: payment confirmed → preparing itinerary
  await setLeadPipelineStatus(
    admin,
    {
      leadId: quote.lead_id ?? null,
      clientId: invoice.client_id,
      force: true,
    },
    'preparing_itinerary',
  ).catch((err) => console.warn('[invoice-cascade] lead preparing_itinerary:', err));

  if (clientError) {
    console.error('[invoice-cascade] client update:', clientError.message);
  }

  // تأكيد paid_at على الفاتورة إن لم يُضبط
  await admin
    .from(INVOICES_TABLE)
    .update({ paid_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .is('paid_at', null);
}
