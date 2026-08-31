'use client';

import { useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Copy, Loader2, MessageCircle, Receipt, X } from 'lucide-react';

import { createInvoiceAction } from '@/app/actions/invoiceActions';
import { verifyQuotationForInvoiceAction } from '@/app/actions/quotationActions';
import {
  buildInvoicePublicUrl,
  buildInvoiceWhatsAppUrl,
  formatInvoiceAmount,
  INVOICE_TYPE_LABEL,
  type InvoiceRow,
  type InvoiceType,
} from '@/lib/crm-invoices';
import type { QuotationRow } from '@/lib/crm-quotations';
import {
  quotationClientName,
  quotationClientPhone,
  quotationInvoiceId,
  quotationTotalPrice,
} from '@/lib/crm-quotations';

type GenerateInvoiceModalProps = {
  quotation: QuotationRow;
  onClose: () => void;
  onCreated?: () => void;
};

export function GenerateInvoiceModal({ quotation, onClose, onCreated }: GenerateInvoiceModalProps) {
  const quoteId = quotationInvoiceId(quotation);
  const defaultAmount = quotationTotalPrice(quotation);
  const clientName = quotationClientName(quotation);
  const clientPhone = quotationClientPhone(quotation);

  const [type, setType] = useState<InvoiceType>('deposit');
  const [amountInput, setAmountInput] = useState(
    defaultAmount > 0 ? String(defaultAmount) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceRow | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const invoiceUrl = createdInvoice ? buildInvoicePublicUrl(createdInvoice.id) : '';
  const whatsAppUrl =
    createdInvoice && invoiceUrl
      ? buildInvoiceWhatsAppUrl({
          phone: clientPhone,
          tripTitle: quotation.title,
          invoiceUrl,
          amount: createdInvoice.amount,
          type: createdInvoice.type,
        })
      : '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!quoteId) {
      setError('معرّف العرض غير صالح.');
      return;
    }

    const amount = Number(String(amountInput).replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('أدخل مبلغاً صالحاً أكبر من صفر.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const verified = await verifyQuotationForInvoiceAction(quoteId);
      if (!verified.ok) {
        throw new Error(verified.error);
      }

      const result = await createInvoiceAction({
        clientId: quotation.client_id,
        quoteId: verified.quoteId,
        tripTitle: quotation.title,
        amount,
        type,
      });
      if (!result.ok) throw new Error(result.error);
      setCreatedInvoice(result.invoice);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إصدار الفاتورة.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInvoiceLink() {
    if (!invoiceUrl) return;
    try {
      await navigator.clipboard.writeText(invoiceUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('انسخ رابط الفاتورة:', invoiceUrl);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-0 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[95%] max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#cda04c]/35 bg-gradient-to-b from-[#0a1410] to-[#0f1e16] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#cda04c]/20 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#cda04c]/80">
              الفوترة
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-black text-white">
              <Receipt className="h-5 w-5 text-[#cda04c]" aria-hidden />
              {createdInvoice ? 'تم الإصدار' : 'إصدار فاتورة'}
            </h2>
            <p className="mt-1 text-xs font-semibold text-white/50">
              {clientName} · {quotation.title || 'عرض السعر'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-white/60 transition hover:bg-white/10"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {createdInvoice ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 px-4 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden />
                <p className="text-base font-black text-emerald-100">
                  ✅ تم إصدار الفاتورة بنجاح
                </p>
                <p className="text-xs font-semibold text-emerald-200/70">
                  {INVOICE_TYPE_LABEL[createdInvoice.type]} ·{' '}
                  {formatInvoiceAmount(createdInvoice.amount)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="mb-2 text-[11px] font-black text-white/55">رابط الفاتورة</p>
                <p
                  className="break-all rounded-xl border border-[#cda04c]/25 bg-[#cda04c]/5 px-3 py-2.5 text-xs font-bold text-[#f5e6c0]"
                  dir="ltr"
                >
                  {invoiceUrl}
                </p>
                <button
                  type="button"
                  onClick={() => void copyInvoiceLink()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/80 transition hover:bg-white/10"
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {linkCopied ? 'تم نسخ الرابط' : 'نسخ الرابط'}
                </button>
              </div>

              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                إرسال رابط السداد عبر الواتساب
              </a>

              {!clientPhone ? (
                <p className="text-center text-[10px] font-semibold text-amber-200/80">
                  لم يُعثر على رقم واتساب للعميل — سيفتح واتساب بدون رقم محدد.
                </p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-black text-white/70">نوع الدفعة</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(['deposit', 'full'] as const).map((option) => {
                    const selected = type === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setType(option)}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-black transition ${
                          selected
                            ? 'border-[#cda04c] bg-[#cda04c]/20 text-[#f5e6c0] ring-2 ring-[#cda04c]/35'
                            : 'border-white/15 bg-white/5 text-white/70 hover:border-[#cda04c]/40'
                        }`}
                        aria-pressed={selected}
                      >
                        {INVOICE_TYPE_LABEL[option]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black text-white/70">المبلغ (ر.س)</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#cda04c]/60 focus:ring-2 focus:ring-[#cda04c]/20"
                  dir="ltr"
                  required
                />
              </label>

              {error ? (
                <p className="rounded-xl border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#cda04c] px-5 py-3.5 text-sm font-black text-[#0a1410] shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Receipt className="h-4 w-4" aria-hidden />
                )}
                {submitting ? 'جارٍ الإصدار…' : 'إصدار الفاتورة'}
              </button>
            </form>
          )}
        </div>

        <div className="border-t border-[#cda04c]/20 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/55 transition hover:bg-white/5"
          >
            {createdInvoice ? 'إغلاق' : 'إلغاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
