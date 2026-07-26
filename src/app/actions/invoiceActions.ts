'use server';

import {
  createInvoiceAdmin,
  fetchInvoiceByIdAdmin,
  fetchInvoiceLedgerAdmin,
  fetchInvoicesForQuoteAdmin,
  fetchQuoteLedgerAdmin,
  markInvoicePaidAdmin,
} from '@/lib/crm-invoices-server';
import type {
  InvoiceLedgerSummary,
  InvoiceRow,
  InvoiceType,
  QuoteLedgerSummary,
} from '@/lib/crm-invoices';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type CreateInvoiceActionResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; error: string };

export async function createInvoiceAction(input: {
  clientId: string | number | null;
  quoteId: string;
  tripTitle?: string;
  amount: number;
  type: InvoiceType;
}): Promise<CreateInvoiceActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const invoice = await createInvoiceAdmin(input);
    return { ok: true, invoice };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إنشاء الفاتورة.',
    };
  }
}

export type GetInvoiceActionResult =
  | { ok: true; invoice: InvoiceRow; ledger: InvoiceLedgerSummary }
  | { ok: false; error: string };

export async function getInvoiceAction(invoiceId: string): Promise<GetInvoiceActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const result = await fetchInvoiceLedgerAdmin(invoiceId);
    if (!result) return { ok: false, error: 'لم يُعثر على الفاتورة.' };
    return { ok: true, invoice: result.invoice, ledger: result.ledger };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل الفاتورة.',
    };
  }
}

export type MarkInvoicePaidActionResult =
  | { ok: true; invoice: InvoiceRow; ledger: InvoiceLedgerSummary }
  | { ok: false; error: string };

/** تأكيد دفع مؤقت من صفحة العميل */
export async function markInvoicePaidAction(
  invoiceId: string,
): Promise<MarkInvoicePaidActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const invoice = await markInvoicePaidAdmin(invoiceId);
    const ledgerResult = await fetchInvoiceLedgerAdmin(invoice.id);
    if (!ledgerResult) {
      return {
        ok: true,
        invoice,
        ledger: {
          quoteId: invoice.quote_id,
          tripTitle: invoice.trip_title,
          totalCost: invoice.amount,
          paidAmount: invoice.amount,
          remainingBalance: 0,
          paidBeforeCurrent: 0,
          currentInvoiceAmount: invoice.amount,
          remainingAfterCurrent: 0,
        },
      };
    }
    return { ok: true, invoice: ledgerResult.invoice, ledger: ledgerResult.ledger };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تأكيد الدفع.',
    };
  }
}

export type GetQuoteLedgerActionResult =
  | { ok: true; ledger: QuoteLedgerSummary }
  | { ok: false; error: string };

export type ListInvoicesForQuoteActionResult =
  | { ok: true; invoices: InvoiceRow[] }
  | { ok: false; error: string };

/** سجل الفواتير لعرض سعر في CRM */
export async function listInvoicesForQuoteAction(
  quoteId: string,
): Promise<ListInvoicesForQuoteActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const invoices = await fetchInvoicesForQuoteAdmin(quoteId);
    return { ok: true, invoices };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل سجل الفواتير.',
    };
  }
}

/** ملخص مالي لصفحة تعديل العرض في CRM */
export async function getQuoteLedgerAction(
  quoteId: string,
  totalCostOverride?: number,
): Promise<GetQuoteLedgerActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const ledger = await fetchQuoteLedgerAdmin(quoteId, {
      totalCostOverride:
        totalCostOverride != null && Number.isFinite(totalCostOverride)
          ? totalCostOverride
          : undefined,
    });
    if (!ledger) return { ok: false, error: 'معرّف العرض غير صالح.' };
    return { ok: true, ledger };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل الملخص المالي.',
    };
  }
}
