'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  approveInvoicePaymentAction,
  rejectInvoiceReceiptAction,
} from '@/app/actions/invoiceActions';
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  INVOICE_REJECTION_PRESETS,
  INVOICE_TYPE_LABEL,
  type InvoiceRow,
} from '@/lib/crm-invoices';
import { dispatchCrmRealtimeRefresh } from '@/lib/crm-realtime-events';

function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url) || url.toLowerCase().includes('application/pdf');
}

function ReceiptLightbox({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const pdf = isPdfUrl(url);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2D3F3A] dark:bg-[#22302C]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-[#2D3F3A]">
          <div className="min-w-0">
            <p
              id={titleId}
              className="truncate text-sm font-bold text-slate-900 dark:text-white"
            >
              {title}
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              راجع المبلغ ورقم الآيبان قبل الاعتماد
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] dark:border-[#2D3F3A] dark:text-slate-300"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-2 dark:bg-[#1A2421] sm:p-4">
          {pdf ? (
            <iframe
              src={url}
              title={title}
              className="h-[75vh] w-full rounded-xl border border-slate-200 bg-white dark:border-[#2D3F3A]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="mx-auto max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
            />
          )}
        </div>
        <div className="flex justify-end border-t border-slate-100 px-4 py-3 dark:border-[#2D3F3A]">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline dark:text-[#D4AF37]"
          >
            فتح في تبويب جديد ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function RejectReasonDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const titleId = useId();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#2D3F3A] dark:bg-[#22302C]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">
          رفض الإيصال
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-500">
          اختر سبباً سريعاً أو اكتب ملاحظة للعميل
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {INVOICE_REJECTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={busy}
              onClick={() => setReason(preset)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] ${
                reason === preset
                  ? 'bg-rose-600 text-white'
                  : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="سبب الرفض…"
          disabled={busy}
          className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-white"
        />

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] dark:border-[#2D3F3A] dark:text-slate-300"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            تأكيد الرفض
          </button>
        </div>
      </div>
    </div>
  );
}

type ReceiptVerificationPanelProps = {
  invoices: InvoiceRow[];
  onApproved?: (invoice: InvoiceRow, quotationStatus: string) => void;
  onRejected?: (invoice: InvoiceRow) => void;
};

/**
 * Premium admin UI: inspect bank-transfer receipt → Approve (CRM cascade) or Reject.
 */
export function ReceiptVerificationPanel({
  invoices,
  onApproved,
  onRejected,
}: ReceiptVerificationPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InvoiceRow | null>(null);

  const handleConfirmPayment = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId || busyId) return;
      setBusyId(invoiceId);
      try {
        const result = await approveInvoicePaymentAction(invoiceId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.welcomeSent) {
          toast.success(result.message);
        } else if (result.message.includes('فشل إرسال')) {
          toast.error(result.message);
        } else {
          toast.success(result.message);
        }
        dispatchCrmRealtimeRefresh({ source: 'invoices', reason: 'paid' });
        onApproved?.(result.invoice, result.quotationStatus);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'تعذر اعتماد الدفع.');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onApproved],
  );

  const handleReject = useCallback(
    async (reason: string) => {
      if (!rejectTarget || busyId) return;
      const invoiceId = rejectTarget.id;
      setBusyId(invoiceId);
      try {
        const result = await rejectInvoiceReceiptAction(invoiceId, reason);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        dispatchCrmRealtimeRefresh({ source: 'invoices', reason: 'rejected' });
        setRejectTarget(null);
        onRejected?.(result.invoice);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'تعذر رفض الإيصال.');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onRejected, rejectTarget],
  );

  if (!invoices.length) return null;

  return (
    <>
      <section
        className="mb-5 space-y-4 rounded-2xl border border-amber-200/90 bg-gradient-to-l from-amber-50 via-white to-orange-50/80 p-4 shadow-sm dark:border-amber-900/40 dark:from-[#2A2418] dark:via-[#22302C] dark:to-[#22302C] sm:p-5"
        role="region"
        aria-label="التحقق من إيصالات الحوالة"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-700/80 dark:text-[#D4AF37]/80">
              Bank Transfer · Pending Verification
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              تحقق من إيصال الحوالة
            </h2>
            <p className="mt-1 max-w-xl text-xs font-medium text-slate-600 dark:text-slate-400">
              العميل رفع إثبات التحويل البنكي (IBAN). افتح الصورة، طابِق المبلغ، ثم أكّد
              أو ارفض — التأكيد يفعّل ترحيل العميل تلقائياً.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
            {invoices.length} بانتظار التحقق
          </span>
        </div>

        <ul className="space-y-3">
          {invoices.map((inv) => {
            const receiptUrl = String(inv.receipt_url ?? '').trim();
            const busy = busyId === inv.id;
            const pdf = receiptUrl ? isPdfUrl(receiptUrl) : false;
            const title = `${INVOICE_TYPE_LABEL[inv.type]} · ${formatInvoiceAmount(inv.amount)}`;

            return (
              <li
                key={inv.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#1A2421]"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch">
                  {/* Thumbnail */}
                  <button
                    type="button"
                    disabled={!receiptUrl || busy}
                    onClick={() =>
                      receiptUrl && setLightbox({ url: receiptUrl, title })
                    }
                    className="group relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-amber-300 active:scale-[0.99] disabled:opacity-50 sm:h-auto sm:w-40 dark:border-[#2D3F3A] dark:bg-[#22302C]"
                    title="عرض الإيصال"
                  >
                    {receiptUrl ? (
                      pdf ? (
                        <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 text-slate-500">
                          <FileText className="h-8 w-8 text-amber-600 dark:text-[#D4AF37]" />
                          <span className="text-[11px] font-semibold">ملف PDF</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={receiptUrl}
                          alt="إيصال الحوالة"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      )
                    ) : (
                      <div className="flex h-full min-h-[9rem] items-center justify-center text-xs font-medium text-slate-400">
                        لا يوجد إيصال
                      </div>
                    )}
                    {receiptUrl ? (
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-950/55 py-1.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                        <Eye className="h-3 w-3" />
                        عرض أكبر
                      </span>
                    ) : null}
                  </button>

                  {/* Meta + actions */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {title}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        {inv.trip_title || 'رحلة Wanderloom'}
                        {' · '}
                        {formatInvoiceDate(inv.updated_at || inv.created_at)}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]">
                        بانتظار التحقق
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || !receiptUrl}
                        onClick={() => void handleConfirmPayment(inv.id)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 sm:flex-none"
                      >
                        {busy && busyId === inv.id && !rejectTarget ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        تأكيد ومطابقة
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectTarget(inv)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-[0.98] disabled:opacity-50 sm:flex-none dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        <XCircle className="h-4 w-4" />
                        رفض الإيصال
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {lightbox ? (
        <ReceiptLightbox
          url={lightbox.url}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      <RejectReasonDialog
        open={Boolean(rejectTarget)}
        busy={Boolean(rejectTarget && busyId === rejectTarget.id)}
        onClose={() => !busyId && setRejectTarget(null)}
        onConfirm={(reason) => void handleReject(reason)}
      />
    </>
  );
}
