'use server';

import {
  createInvoiceAdmin,
  fetchInvoiceByIdAdmin,
  fetchInvoiceLedgerAdmin,
  fetchInvoicesForQuoteAdmin,
  fetchQuoteLedgerAdmin,
  markInvoicePaidAdmin,
  rejectInvoiceReceiptAdmin,
  submitInvoiceReceiptAdmin,
} from '@/lib/crm-invoices-server';
import type {
  InvoiceLedgerSummary,
  InvoiceRow,
  InvoiceType,
  QuoteLedgerSummary,
} from '@/lib/crm-invoices';
import { coerceQuotationIdForDb, normalizeQuotationId } from '@/lib/crm-quotations';
import {
  syncLeadsPaymentConfirmedByQuoteContext,
  updatePipelineStatus,
} from '@/lib/lead-pipeline-automation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
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
  | {
      ok: true;
      invoice: InvoiceRow;
      ledger: InvoiceLedgerSummary;
      quotationStatus: string | null;
    }
  | { ok: false; error: string };

export async function getInvoiceAction(invoiceId: string): Promise<GetInvoiceActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const result = await fetchInvoiceLedgerAdmin(invoiceId);
    if (!result) return { ok: false, error: 'لم يُعثر على الفاتورة.' };
    return {
      ok: true,
      invoice: result.invoice,
      ledger: result.ledger,
      quotationStatus: result.quotationStatus,
    };
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
    const { invoice } = await markInvoicePaidAdmin(invoiceId);
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

export type ApproveInvoicePaymentActionResult =
  | {
      ok: true;
      invoice: InvoiceRow;
      ledger: InvoiceLedgerSummary;
      quotationStatus: string;
      message: string;
      welcomeSent: boolean;
      welcomeSimulated?: boolean;
    }
  | { ok: false; error: string };

/**
 * Admin: اعتماد الحوالة من شاشة تعديل العرض
 * — invoices.status = paid (+ cascade)
 * — quotations.status = payment_confirmed
 * — leads.status = payment_confirmed (Kanban SSOT)
 * — رسالة ترحيب آلية (واتساب / بريد) بعد التحويل
 */
export async function approveInvoicePaymentAction(
  invoiceId: string,
): Promise<ApproveInvoicePaymentActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(invoiceId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الفاتورة غير صالح.' };

  try {
    const { invoice, welcome } = await markInvoicePaidAdmin(id);
    const ledgerResult = await fetchInvoiceLedgerAdmin(invoice.id);
    const admin = createSupabaseAdminClient();

    // Force quotation status to payment_confirmed (cascade may already have set it)
    let quotationStatus = 'payment_confirmed';
    let quoteLeadId: string | null = null;
    let quoteClientId: string | number | null = invoice.client_id;
    let clientNameHint: string | null = invoice.client_name?.trim() || null;

    try {
      const quoteId = normalizeQuotationId(invoice.quote_id);
      if (quoteId) {
        const updatedAt = new Date().toISOString();
        let { error } = await admin
          .from('quotations')
          .update({ status: 'payment_confirmed', updated_at: updatedAt })
          .eq('id', coerceQuotationIdForDb(quoteId));
        if (error && /payment_confirmed|check|constraint|status/i.test(error.message ?? '')) {
          const fallbackStatus =
            ledgerResult && ledgerResult.ledger.remainingBalance <= 0
              ? 'fully_paid'
              : 'deposit_paid';
          const retry = await admin
            .from('quotations')
            .update({ status: fallbackStatus, updated_at: updatedAt })
            .eq('id', coerceQuotationIdForDb(quoteId));
          error = retry.error;
          quotationStatus = fallbackStatus;
        }
        if (error) {
          console.warn('[approve-payment] quotation status:', error.message);
        }

        const { data: qrow } = await admin
          .from('quotations')
          .select('lead_id, client_id, clients(name)')
          .eq('id', coerceQuotationIdForDb(quoteId))
          .maybeSingle();
        if (qrow) {
          quoteLeadId =
            String((qrow as { lead_id?: unknown }).lead_id ?? '').trim() || null;
          const cid = (qrow as { client_id?: string | number | null }).client_id;
          if (cid != null && String(cid).trim() !== '') quoteClientId = cid;
          const embeddedName = String(
            ((qrow as { clients?: { name?: unknown } | null }).clients?.name ?? '') as string,
          ).trim();
          if (embeddedName) clientNameHint = embeddedName;
        }
      }
    } catch (statusErr) {
      console.warn('[approve-payment] quotation status force failed:', statusErr);
    }

    // CRITICAL: Kanban reads leads.status — force it here every approve (even re-approve)
    await updatePipelineStatus(
      admin,
      {
        leadId: quoteLeadId,
        clientId: quoteClientId,
        clientNameHint,
        quoteId: normalizeQuotationId(invoice.quote_id) || null,
        force: true,
      },
      'payment_confirmed',
    );
    const synced = await syncLeadsPaymentConfirmedByQuoteContext(admin, {
      leadId: quoteLeadId,
      clientId: quoteClientId,
      clientNameHint,
    });
    if (synced === 0) {
      console.warn(
        '[approve-payment] no leads updated for Kanban — check lead_id/client_id linkage',
        { quoteLeadId, quoteClientId, clientNameHint, invoiceId: id },
      );
    }

    const ledger =
      ledgerResult?.ledger ??
      ({
        quoteId: invoice.quote_id,
        tripTitle: invoice.trip_title,
        totalCost: invoice.amount,
        paidAmount: invoice.amount,
        remainingBalance: 0,
        paidBeforeCurrent: 0,
        currentInvoiceAmount: invoice.amount,
        remainingAfterCurrent: 0,
      } satisfies InvoiceLedgerSummary);

    const deliveredViaProvider = Boolean(
      welcome?.channels.includes('whatsapp') || welcome?.channels.includes('email'),
    );
    const welcomeSent = Boolean(deliveredViaProvider || (welcome?.ok && !welcome.error));
    const welcomeFailed = Boolean(welcome?.error && !deliveredViaProvider);

    let message =
      synced > 0
        ? 'تم اعتماد الدفع ونقل البطاقة إلى «تم الدفع / المسارات».'
        : 'تم اعتماد الدفع بنجاح — العرض الآن في حالة تأكيد الدفع.';

    if (deliveredViaProvider && !welcome?.simulated) {
      message = 'تم تأكيد العميل وإرسال رسالة الترحيب آلياً!';
    } else if (deliveredViaProvider || welcomeSent) {
      message =
        'تم تأكيد العميل وإعداد رسالة الترحيب (محاكاة — راجع سجل السيرفر قبل ربط API).';
    } else if (welcomeFailed) {
      message =
        'تم تأكيد العميل، ولكن فشل إرسال الرسالة الآلية. راجع السجل أو أعد الإرسال يدوياً.';
    }

    return {
      ok: true,
      invoice: ledgerResult?.invoice ?? invoice,
      ledger,
      quotationStatus,
      message,
      welcomeSent,
      welcomeSimulated: welcome?.simulated,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر اعتماد الدفع.',
    };
  }
}

export type RejectInvoiceReceiptActionResult =
  | { ok: true; invoice: InvoiceRow; message: string }
  | { ok: false; error: string };

/**
 * Admin: رفض إيصال الحوالة البنكية
 * — invoices.status = rejected + rejection_reason
 */
export async function rejectInvoiceReceiptAction(
  invoiceId: string,
  reason?: string | null,
): Promise<RejectInvoiceReceiptActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(invoiceId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الفاتورة غير صالح.' };

  try {
    const invoice = await rejectInvoiceReceiptAdmin(id, reason);
    return {
      ok: true,
      invoice,
      message: 'تم رفض الإيصال. يمكن للعميل رفع حوالة جديدة.',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر رفض الإيصال.',
    };
  }
}

export type SubmitInvoiceReceiptActionResult =
  | { ok: true; invoice: InvoiceRow; ledger: InvoiceLedgerSummary; message: string }
  | { ok: false; error: string };

/** Save receipt URL (after client-side Storage upload) — strings only, no File. */
export async function submitInvoiceReceiptAction(
  invoiceId: string,
  receiptUrl: string,
): Promise<SubmitInvoiceReceiptActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(invoiceId ?? '').trim();
  const url = String(receiptUrl ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف الفاتورة غير صالح.' };
  if (!url) return { ok: false, error: 'رابط صورة الحوالة غير صالح.' };

  try {
    const invoice = await submitInvoiceReceiptAdmin(id, url);
    const ledgerResult = await fetchInvoiceLedgerAdmin(invoice.id);
    const message =
      'تم استلام صورة الحوالة بنجاح، سيتم مراجعتها وتأكيد حجزك قريباً!';
    if (!ledgerResult) {
      return {
        ok: true,
        invoice,
        message,
        ledger: {
          quoteId: invoice.quote_id,
          tripTitle: invoice.trip_title,
          totalCost: invoice.amount,
          paidAmount: invoice.status === 'paid' ? invoice.amount : 0,
          remainingBalance: invoice.status === 'paid' ? 0 : invoice.amount,
          paidBeforeCurrent: 0,
          currentInvoiceAmount: invoice.amount,
          remainingAfterCurrent: invoice.status === 'paid' ? 0 : invoice.amount,
        },
      };
    }
    return {
      ok: true,
      invoice: ledgerResult.invoice,
      ledger: ledgerResult.ledger,
      message,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حفظ صورة الحوالة.',
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
