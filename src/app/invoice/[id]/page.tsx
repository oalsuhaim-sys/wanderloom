'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  Loader2,
  QrCode,
  Receipt,
  Upload,
  Wallet,
  X,
} from 'lucide-react';

import {
  getInvoiceAction,
  submitInvoiceReceiptAction,
} from '@/app/actions/invoiceActions';
import {
  uploadInvoicePaymentReceipt,
  WANDERLOOM_BANK_DETAILS,
  WANDERLOOM_PAYMENT_QR_SRC,
} from '@/lib/bank-checkout';
import {
  formatInvoiceAmount,
  INVOICE_STATUS_LABEL,
  INVOICE_TYPE_LABEL,
  type InvoiceLedgerSummary,
  type InvoiceRow,
} from '@/lib/crm-invoices';

const PANEL =
  'rounded-[1.75rem] border border-[#d4af37]/20 bg-gradient-to-b from-[#121816] to-[#0a0d0b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8';

const GOLD = 'text-[#d4af37]';

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-dvh bg-[#070908] text-white"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.12), transparent)',
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8 sm:py-12">{children}</div>
    </div>
  );
}

function LedgerRow({
  label,
  value,
  emphasize,
  gold,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  gold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0 ${
        emphasize ? 'rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-3' : ''
      }`}
    >
      <span
        className={`text-xs font-bold ${emphasize ? 'text-[#d4af37]' : 'text-white/55'}`}
      >
        {label}
      </span>
      <span
        className={`text-sm font-black ${
          gold || emphasize ? 'text-[#d4af37]' : 'text-white'
        }`}
        dir="ltr"
      >
        {formatInvoiceAmount(value)}
      </span>
    </div>
  );
}

function IbanCopyToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      <style>{`
        @keyframes invoiceCopyToastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <span
          className="rounded-full border border-[#d4af37]/40 bg-[#0a0d0b]/95 px-4 py-2 text-xs font-black text-[#d4af37] shadow-lg"
          style={{ animation: 'invoiceCopyToastIn 0.25s ease-out forwards' }}
        >
          تم النسخ
        </span>
      </div>
    </>
  );
}

function SuccessToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible || !message) return null;
  return (
    <>
      <style>{`
        @keyframes invoiceSuccessToastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-x-0 top-6 z-[100] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <span
          className="max-w-md rounded-2xl border border-emerald-400/40 bg-emerald-950/95 px-4 py-3 text-center text-xs font-black leading-relaxed text-emerald-100 shadow-lg"
          style={{ animation: 'invoiceSuccessToastIn 0.25s ease-out forwards' }}
        >
          {message}
        </span>
      </div>
    </>
  );
}

function PaymentQrSection() {
  return (
    <div className="mt-5 rounded-2xl border border-[#d4af37]/20 bg-black/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <QrCode className={`h-4 w-4 ${GOLD}`} aria-hidden />
        <h4 className="text-sm font-black text-white">رمز الاستجابة السريعة (QR)</h4>
      </div>
      <p className="mb-4 text-[11px] font-semibold leading-relaxed text-white/45">
        امسح الرمز عبر تطبيق البنك أو STC Pay لإتمام التحويل بسرعة.
      </p>

      <div className="mx-auto flex max-w-[220px] flex-col items-center">
        <div className="flex w-full items-center justify-center rounded-2xl border border-[#d4af37]/30 bg-white p-4 shadow-[inset_0_0_40px_rgba(212,175,55,0.06)]">
          {/* Native img avoids next/image optimizer quirks for local public assets */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WANDERLOOM_PAYMENT_QR_SRC}
            alt="Payment QR Code"
            width={192}
            height={192}
            className="mx-auto h-48 w-48 rounded-xl object-contain"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}

export default function PublicInvoicePage() {
  const params = useParams();
  const invoiceId = String(params?.id ?? '').trim();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [ledger, setLedger] = useState<InvoiceLedgerSummary | null>(null);
  const [quotationStatus, setQuotationStatus] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [ibanCopied, setIbanCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setError('رابط الفاتورة غير صالح.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const result = await getInvoiceAction(invoiceId);
    setLoading(false);

    if (!result.ok) {
      setInvoice(null);
      setLedger(null);
      setQuotationStatus(null);
      setError(result.error);
      return;
    }

    setInvoice(result.invoice);
    setLedger(result.ledger);
    setQuotationStatus(result.quotationStatus);
    if (result.invoice.status === 'rejected') {
      setTransferSubmitted(false);
    } else if (
      result.invoice.status === 'paid' ||
      result.invoice.status === 'payment_review' ||
      Boolean(result.invoice.receipt_url)
    ) {
      setTransferSubmitted(true);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearReceiptSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setReceiptFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function selectReceiptFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يُقبل رفع الصور فقط (JPG · PNG · WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم الملف يتجاوز 10 ميجابايت.');
      return;
    }
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function copyIban() {
    try {
      await navigator.clipboard.writeText(WANDERLOOM_BANK_DETAILS.iban.replace(/\s+/g, ''));
      setIbanCopied(true);
      window.setTimeout(() => setIbanCopied(false), 2000);
    } catch {
      window.prompt('انسخ رقم الآيبان:', WANDERLOOM_BANK_DETAILS.iban);
    }
  }

  async function handleUpload() {
    if (!invoice || !receiptFile || isUploading || transferSubmitted) return;
    setIsUploading(true);
    setError('');
    setSuccessMessage('');
    try {
      // 1) Upload File on the client — never pass File into a Server Action
      const upload = await uploadInvoicePaymentReceipt({
        invoiceId: invoice.id,
        quoteId: invoice.quote_id,
        file: receiptFile,
      });
      if (!upload.ok || !upload.publicUrl) {
        throw new Error(upload.error || 'تعذر رفع صورة الحوالة.');
      }

      // 2) Persist URL + status via service-role action (strings only)
      const result = await submitInvoiceReceiptAction(invoice.id, upload.publicUrl);
      if (!result.ok) throw new Error(result.error);
      setInvoice(result.invoice);
      setLedger(result.ledger);
      setTransferSubmitted(true);
      setSuccessMessage(result.message);
      clearReceiptSelection();
      window.setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع صورة الحوالة.');
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    selectReceiptFile(e.dataTransfer.files?.[0]);
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#d4af37]">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm font-bold text-white/60">جارٍ تحميل الفاتورة…</p>
        </div>
      </PageShell>
    );
  }

  if (error && !invoice) {
    return (
      <PageShell>
        <div className={`${PANEL} text-center`}>
          <Receipt className="mx-auto h-10 w-10 text-[#d4af37]/60" aria-hidden />
          <p className="mt-4 text-sm font-bold text-rose-300">{error}</p>
        </div>
      </PageShell>
    );
  }

  if (!invoice) return null;

  const quoteStatus = String(quotationStatus ?? '').trim().toLowerCase();
  const paymentConfirmed =
    invoice.status === 'paid' ||
    quoteStatus === 'payment_confirmed' ||
    quoteStatus === 'deposit_paid' ||
    quoteStatus === 'fully_paid';

  const isRejected = invoice.status === 'rejected';
  const awaitingReview =
    !paymentConfirmed &&
    !isRejected &&
    (transferSubmitted ||
      invoice.status === 'payment_review' ||
      Boolean(invoice.receipt_url));

  const clientName = invoice.client_name?.trim() || 'ضيفنا الكريم';
  const statusLabel = paymentConfirmed
    ? 'تم تأكيد الدفع'
    : isRejected
      ? 'إيصال مرفوض — أعد الرفع'
      : awaitingReview
        ? 'جاري مراجعة الدفع'
        : INVOICE_STATUS_LABEL[invoice.status];

  return (
    <PageShell>
      <IbanCopyToast visible={ibanCopied} />
      <SuccessToast message={successMessage} visible={Boolean(successMessage)} />

      <header className="mb-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#d4af37]/80">
          Wanderloom
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">فاتورة تأكيد الحجز</h1>
        <p className="mt-1 text-xs font-semibold text-white/45">Payment Request</p>
      </header>

      <section className={PANEL}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-white/45">الرحلة</p>
            <h2 className="mt-1 text-lg font-black text-[#d4af37]">
              {invoice.trip_title || ledger?.tripTitle || 'رحلة Wanderloom'}
            </h2>
            <p className="mt-2 text-sm font-bold text-white/80">{clientName}</p>
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${
              paymentConfirmed
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
                : isRejected
                  ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30'
                  : awaitingReview
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-[10px] font-bold text-white/45">نوع الدفعة</p>
            <p className="mt-1 text-sm font-black text-white">{INVOICE_TYPE_LABEL[invoice.type]}</p>
          </div>
          <div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-3">
            <p className="text-[10px] font-bold text-[#d4af37]/80">المبلغ المستحق</p>
            <p className="mt-1 text-lg font-black text-[#d4af37]" dir="ltr">
              {formatInvoiceAmount(invoice.amount)}
            </p>
          </div>
        </div>
      </section>

      {paymentConfirmed ? (
        <section className={`${PANEL} mt-5`}>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-400/35 bg-gradient-to-b from-emerald-950/50 to-emerald-950/20 px-5 py-10 text-center shadow-[0_0_60px_rgba(52,211,153,0.12)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_40px_rgba(52,211,153,0.35)]">
              <CheckCircle2 className="h-9 w-9 text-emerald-400" aria-hidden />
            </div>
            <p className="max-w-sm text-base font-black leading-relaxed text-emerald-50 sm:text-lg">
              🎉 تم تأكيد الدفع بنجاح! يتم الآن تجهيز مسار رحلتك وسيتم إرساله لك قريباً.
            </p>
            <p className="text-xs font-semibold text-emerald-200/70">
              Payment confirmed successfully — your itinerary is being prepared.
            </p>
          </div>
        </section>
      ) : (
        <section className={`${PANEL} mt-5`}>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#d4af37]" aria-hidden />
            <h3 className="text-base font-black text-white">التحويل البنكي</h3>
          </div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/50">
            حوّل المبلغ المستحق إلى الحساب أدناه، ثم أرفق صورة الحوالة واضغط «تأكيد الدفع».
          </p>

          <div className="mt-5 rounded-2xl border border-[#d4af37]/25 bg-gradient-to-b from-[#0f1412] to-[#070908] p-4">
            <h4 className={`mb-4 text-sm font-black ${GOLD}`}>تفاصيل الحساب البنكي</h4>
            <dl className="space-y-3">
              <div className="rounded-xl border border-white/8 bg-black/35 px-4 py-3">
                <dt className="text-[10px] font-bold text-white/40">اسم البنك</dt>
                <dd className="mt-1 text-sm font-black text-white">
                  {WANDERLOOM_BANK_DETAILS.bankName}
                </dd>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 px-4 py-3">
                <dt className="text-[10px] font-bold text-white/40">المستفيد</dt>
                <dd className="mt-1 text-sm font-black text-white">
                  {WANDERLOOM_BANK_DETAILS.accountName}
                </dd>
              </div>
              <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/8 px-4 py-3">
                <dt className="text-[10px] font-bold text-[#d4af37]/75">رقم الآيبان (IBAN)</dt>
                <dd className="mt-2 flex items-center justify-between gap-3">
                  <span
                    className="font-mono text-sm font-black tracking-wide text-[#f5f0e6]"
                    dir="ltr"
                  >
                    {WANDERLOOM_BANK_DETAILS.iban}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyIban()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/12 px-3 py-1.5 text-[10px] font-black text-[#d4af37] transition hover:bg-[#d4af37]/22"
                    aria-label="نسخ رقم الآيبان"
                  >
                    {ibanCopied ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    نسخ
                  </button>
                </dd>
              </div>
            </dl>

            <PaymentQrSection />
          </div>

          {awaitingReview ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-950/25 px-4 py-5 text-center">
              <CheckCircle2 className="h-8 w-8 text-amber-300" aria-hidden />
              <p className="text-sm font-black leading-relaxed text-amber-50">
                تم استلام صورة الحوالة بنجاح، سيتم مراجعتها وتأكيد حجزك قريباً!
              </p>
              <p className="text-xs font-semibold text-amber-200/65">
                شكراً لثقتك — فريق Wanderloom سيتواصل معك بعد التحقق من التحويل.
              </p>
            </div>
          ) : (
          <div className="mt-6 space-y-4">
            {isRejected ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-950/30 px-4 py-4 text-center">
                <p className="text-sm font-black text-rose-100">تم رفض الإيصال السابق</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-200/80">
                  {invoice.rejection_reason?.trim() ||
                    'يرجى رفع صورة حوالة أوضح تطابق مبلغ الفاتورة.'}
                </p>
              </div>
            ) : null}
            <div>
              <h4 className="mb-2 text-sm font-black text-white">إرفاق صورة الحوالة</h4>
              <p className="mb-3 text-[11px] font-semibold text-white/40">
                اسحب الصورة هنا أو اضغط للاختيار — صور فقط حتى 10 ميجابايت
              </p>

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragOver
                    ? 'border-[#d4af37]/60 bg-[#d4af37]/10'
                    : 'border-white/15 bg-black/20 hover:border-[#d4af37]/35 hover:bg-[#d4af37]/5'
                }`}
              >
                {previewUrl ? (
                  <>
                    <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-[#d4af37]/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="معاينة صورة الحوالة"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="max-w-full truncate px-2 text-xs font-bold text-[#d4af37]/90">
                      {receiptFile?.name}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearReceiptSelection();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:text-white"
                    >
                      <X className="h-3 w-3" aria-hidden />
                      إزالة
                    </button>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-10 w-10 text-[#d4af37]/55" aria-hidden />
                    <p className="text-sm font-black text-white/80">اضغط أو اسحب صورة الحوالة هنا</p>
                    <p className="text-[11px] font-semibold text-white/35">JPG · PNG · WebP</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  selectReceiptFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <button
              type="button"
              disabled={!receiptFile || isUploading}
              onClick={() => void handleUpload()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d4af37] px-5 py-3.5 text-sm font-black text-[#0a0d0b] shadow-[0_12px_40px_rgba(212,175,55,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {isUploading ? 'جارٍ الرفع…' : 'تأكيد الدفع'}
            </button>
          </div>
          )}

          {error ? (
            <p className="mt-3 text-center text-xs font-bold text-rose-300">{error}</p>
          ) : null}
        </section>
      )}

      {ledger ? (
        <section className={`${PANEL} mt-5`} aria-label="ملخص الحساب">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#d4af37]" aria-hidden />
            <h3 className="text-base font-black text-white">ملخص الحساب</h3>
          </div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Ledger Summary
          </p>
          <div className="space-y-0">
            <LedgerRow label="إجمالي قيمة الرحلة" value={ledger.totalCost} gold />
            <LedgerRow label="ما تم سداده مسبقاً" value={ledger.paidBeforeCurrent} />
            <LedgerRow
              label="الدفعة الحالية المطلوبة"
              value={ledger.currentInvoiceAmount}
              emphasize
            />
            <LedgerRow
              label="المتبقي بعد سداد هذه الدفعة"
              value={ledger.remainingAfterCurrent}
              gold
            />
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-center text-[10px] font-semibold text-white/30">
        فاتورة #{invoice.id.slice(0, 8)}
      </p>
    </PageShell>
  );
}
