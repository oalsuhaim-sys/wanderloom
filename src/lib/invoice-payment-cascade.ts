import 'server-only';

import { revalidatePath } from 'next/cache';

import {
  SALES_STAGE_ACTIVE_TRAVELER,
  SALES_STAGE_CONFIRMED,
} from '@/lib/client-sales-stage';
import {
  coerceQuotationIdForDb,
  mapQuotationRow,
  normalizeQuotationId,
  quotationTotalPrice,
} from '@/lib/crm-quotations';
import { convertGroupPassengerOnInvoicePaid } from '@/lib/invoice-payment-group-conversion';
import {
  setLeadPipelineStatus,
  syncLeadsPaymentConfirmedByQuoteContext,
  updatePipelineStatus,
} from '@/lib/lead-pipeline-automation';
import {
  sendWelcomeNotification,
  type WelcomeNotificationResult,
} from '@/lib/welcome-notifications';
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

export type InvoicePaymentCascadeResult = {
  welcome: WelcomeNotificationResult | null;
};

/**
 * بعد تحويل فاتورة إلى paid: يُحدّث عرض السعر والعميل في معاملة منطقية واحدة.
 * يعتمد مجموع الفواتير المدفوعة كمصدر حقيقة لتجنب الازدواجية.
 * بعد نجاح التحويل: يُرسل رسالة ترحيب آلية (واتساب / بريد).
 */
export async function runInvoicePaymentCascade(
  admin: SupabaseClient,
  invoice: {
    id: string;
    quote_id: string;
    client_id: string | null;
    amount: number;
  },
): Promise<InvoicePaymentCascadeResult> {
  const empty: InvoicePaymentCascadeResult = { welcome: null };
  const quoteId = normalizeQuotationId(invoice.quote_id);
  if (!quoteId) return empty;

  const quoteRaw = await fetchQuotationRecord(admin, quoteId);
  if (!quoteRaw) {
    console.warn('[invoice-cascade] quotation not found:', quoteId);
    return empty;
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
    status: 'payment_confirmed',
    updated_at: new Date().toISOString(),
  };

  let { error: quoteError } = await admin
    .from(QUOTATIONS_TABLE)
    .update(quoteUpdate)
    .eq('id', coerceQuotationIdForDb(quoteId));

  if (quoteError && /payment_confirmed|check|constraint|status/i.test(quoteError.message ?? '')) {
    // Schema without payment_confirmed — keep deposit/full granularity
    const fallback = await admin
      .from(QUOTATIONS_TABLE)
      .update({
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coerceQuotationIdForDb(quoteId));
    quoteError = fallback.error;
  }

  if (quoteError) {
    console.error('[invoice-cascade] quotation update:', quoteError.message);
    throw new Error(quoteError.message || 'تعذر تحديث عرض السعر بعد الدفع.');
  }

  // Always advance Kanban (leads.status) — even when invoice.client_id is missing
  const leadClientId = invoice.client_id ?? quote.client_id ?? null;
  await updatePipelineStatus(
    admin,
    {
      leadId: quote.lead_id ?? null,
      clientId: leadClientId,
      force: true,
    },
    'payment_confirmed',
  ).catch(async (err) => {
    console.warn('[invoice-cascade] lead payment_confirmed:', err);
    await setLeadPipelineStatus(
      admin,
      {
        leadId: quote.lead_id ?? null,
        clientId: leadClientId,
        force: true,
      },
      'preparing_itinerary',
    ).catch((fallbackErr) =>
      console.warn('[invoice-cascade] lead preparing_itinerary:', fallbackErr),
    );
  });

  // Extra heal: match by client display name when FKs did not hit any lead row
  let clientNameHint: string | null = null;
  if (leadClientId != null) {
    const { data: clientRow } = await admin
      .from('clients')
      .select('name')
      .eq('id', coerceQuotationIdForDb(leadClientId))
      .maybeSingle();
    clientNameHint = String((clientRow as { name?: unknown } | null)?.name ?? '').trim() || null;
  }
  await syncLeadsPaymentConfirmedByQuoteContext(admin, {
    leadId: quote.lead_id ?? null,
    clientId: leadClientId,
    clientNameHint,
  }).catch((err) => console.warn('[invoice-cascade] lead name heal:', err));

  if (!invoice.client_id && !quote.client_id) {
    // No client row to update — lead sync above is enough
  } else {
    const clientIdForStage = invoice.client_id ?? quote.client_id;
    const clientStage =
      paymentStatus === 'fully_paid' ? SALES_STAGE_ACTIVE_TRAVELER : SALES_STAGE_CONFIRMED;

    const { error: clientError } = await admin
      .from('clients')
      .update({
        sales_stage: clientStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coerceQuotationIdForDb(clientIdForStage!));

    if (clientError) {
      console.error('[invoice-cascade] client update:', clientError.message);
    }
  }

  // تأكيد paid_at على الفاتورة إن لم يُضبط
  await admin
    .from(INVOICES_TABLE)
    .update({ paid_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .is('paid_at', null);

  // Payment confirmation → CRM conversion (clients + group_members + lead Paid/Confirmed)
  let invoiceTripTitle: string | null = null;
  try {
    const { data: invMeta } = await admin
      .from(INVOICES_TABLE)
      .select('trip_title')
      .eq('id', invoice.id)
      .maybeSingle();
    invoiceTripTitle =
      String((invMeta as { trip_title?: unknown } | null)?.trip_title ?? '').trim() || null;
  } catch {
    /* optional column */
  }

  const conversion = await convertGroupPassengerOnInvoicePaid(admin, {
    leadId: quote.lead_id ?? null,
    clientId: leadClientId,
    quoteTripCategory: quote.trip_category ?? null,
    invoiceTripTitle,
    quoteTitle: quote.title ?? null,
  }).catch((err) => {
    console.error('[invoice-cascade] group conversion:', err);
    return null;
  });

  if (conversion?.ok && !conversion.skipped) {
    revalidatePath('/crm/radar');
    revalidatePath('/crm/clients');
    revalidatePath('/crm/finance');
    revalidatePath('/crm/groups');
    if (conversion.clientId) revalidatePath(`/crm/clients/${conversion.clientId}`);
    if (conversion.tripId) revalidatePath(`/crm/groups/${conversion.tripId}`);
  }

  // Automated welcome — after CRM conversion / payment confirm (never fails cascade)
  let welcome: WelcomeNotificationResult | null = null;
  try {
    let customerName =
      conversion?.customerName?.trim() ||
      clientNameHint?.trim() ||
      '';
    let customerPhone = conversion?.customerPhone?.trim() || '';
    let customerEmail = conversion?.customerEmail?.trim() || null;
    const clientIdForWelcome =
      conversion?.clientId || leadClientId || invoice.client_id || quote.client_id;

    if (clientIdForWelcome && (!customerName || !customerPhone)) {
      const { data: clientRow } = await admin
        .from('clients')
        .select('name, phone_wa, email')
        .eq('id', coerceQuotationIdForDb(clientIdForWelcome))
        .maybeSingle();
      if (clientRow) {
        const row = clientRow as {
          name?: unknown;
          phone_wa?: unknown;
          email?: unknown;
        };
        if (!customerName) customerName = String(row.name ?? '').trim();
        if (!customerPhone) customerPhone = String(row.phone_wa ?? '').trim();
        if (!customerEmail) {
          customerEmail = String(row.email ?? '').trim() || null;
        }
      }
    }

    const destination =
      Array.isArray(quote.destinations) && quote.destinations.length
        ? quote.destinations.join(' · ')
        : null;

    welcome = await sendWelcomeNotification(
      {
        name: customerName || 'ضيفنا الكريم',
        phone: customerPhone || null,
        email: customerEmail,
        clientId: clientIdForWelcome != null ? String(clientIdForWelcome) : null,
      },
      {
        title:
          conversion?.tripTitle ||
          invoiceTripTitle ||
          quote.title ||
          'رحلة Wanderloom',
        destination,
        startDate: quote.start_date,
        endDate: quote.end_date,
        tripId: conversion?.tripId ?? null,
        amountPaid: invoice.amount,
      },
    );
  } catch (err) {
    console.error('[invoice-cascade] welcome notification:', err);
    welcome = {
      ok: false,
      channels: ['log'],
      error: err instanceof Error ? err.message : 'welcome failed',
    };
  }

  return { welcome };
}
