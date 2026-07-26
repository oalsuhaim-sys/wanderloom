import { siteOrigin } from '@/lib/bank-checkout';
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions';

export type InvoiceType = 'deposit' | 'full';
export type InvoiceStatus = 'pending' | 'paid';

/** ملخص مالي لعرض السعر — يُحسب من الفواتير المدفوعة */
export type QuoteLedgerSummary = {
  quoteId: string;
  tripTitle: string;
  /** إجمالي تكلفة الرحلة */
  totalCost: number;
  /** مجموع فواتير status = paid */
  paidAmount: number;
  /** المتبقي = الإجمالي − المدفوع */
  remainingBalance: number;
};

/** ملخص دفتر للعميل على صفحة فاتورة واحدة */
export type InvoiceLedgerSummary = QuoteLedgerSummary & {
  /** ما تم سداده مسبقاً (بدون الفاتورة الحالية) */
  paidBeforeCurrent: number;
  /** الدفعة الحالية المطلوبة */
  currentInvoiceAmount: number;
  /** المتبقي بعد سداد هذه الدفعة */
  remainingAfterCurrent: number;
};

export function buildQuoteLedger(
  quoteId: string,
  tripTitle: string,
  totalCost: number,
  paidAmount: number,
): QuoteLedgerSummary {
  const total = Math.max(0, Number(totalCost) || 0);
  const paid = Math.max(0, Number(paidAmount) || 0);
  return {
    quoteId,
    tripTitle: tripTitle.trim() || 'رحلة Wanderloom',
    totalCost: total,
    paidAmount: paid,
    remainingBalance: Math.max(0, Math.round((total - paid) * 100) / 100),
  };
}

export function buildInvoiceLedger(params: {
  quoteId: string;
  tripTitle: string;
  totalCost: number;
  paidAmountAll: number;
  paidBeforeCurrent: number;
  currentInvoiceAmount: number;
}): InvoiceLedgerSummary {
  const base = buildQuoteLedger(
    params.quoteId,
    params.tripTitle,
    params.totalCost,
    params.paidAmountAll,
  );
  const current = Math.max(0, Number(params.currentInvoiceAmount) || 0);
  const paidBefore = Math.max(0, Number(params.paidBeforeCurrent) || 0);
  return {
    ...base,
    paidBeforeCurrent: paidBefore,
    currentInvoiceAmount: current,
    remainingAfterCurrent: Math.max(
      0,
      Math.round((base.totalCost - paidBefore - current) * 100) / 100,
    ),
  };
}

export type InvoiceRow = {
  id: string;
  client_id: string | null;
  quote_id: string;
  trip_title: string;
  amount: number;
  type: InvoiceType;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  client_name?: string | null;
  client_phone?: string | null;
};

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  deposit: 'عربون',
  full: 'مبلغ كامل',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: 'بانتظار الدفع',
  paid: 'تم الدفع',
};

/** حالات الفاتورة التي تُحسب كمبالغ مستحقة في التقارير */
export const INVOICE_RECEIVABLE_DB_STATUSES = ['pending', 'awaiting_payment', 'issued'] as const;

export function isInvoiceReceivableStatus(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'pending' || s === 'awaiting_payment' || s === 'issued';
}

export function parseInvoiceType(raw: unknown): InvoiceType {
  return String(raw ?? '').trim() === 'full' ? 'full' : 'deposit';
}

export function parseInvoiceStatus(raw: unknown): InvoiceStatus {
  return String(raw ?? '').trim() === 'paid' ? 'paid' : 'pending';
}

export function mapInvoiceRow(raw: Record<string, unknown>): InvoiceRow {
  return {
    id: String(raw.id ?? '').trim(),
    client_id: raw.client_id != null ? String(raw.client_id) : null,
    quote_id: String(raw.quote_id ?? '').trim(),
    trip_title: String(raw.trip_title ?? '').trim(),
    amount: Number(raw.amount) || 0,
    type: parseInvoiceType(raw.type),
    status: parseInvoiceStatus(raw.status),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    paid_at: raw.paid_at != null ? String(raw.paid_at) : null,
  };
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function buildInvoicePublicUrl(invoiceId: string, origin?: string): string {
  const base = siteOrigin(origin);
  const id = encodeURIComponent(String(invoiceId).trim());
  if (!base) return `/invoice/${id}`;
  return `${base}/invoice/${id}`;
}

export function formatInvoiceAmount(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

/** رسالة واتساب لإرسال رابط الفاتورة للعميل */
export function buildInvoiceWhatsAppMessage(params: {
  tripTitle?: string;
  invoiceUrl: string;
  amount?: number;
  type: InvoiceType;
}): string {
  const typeLabel = INVOICE_TYPE_LABEL[params.type];
  return `أهلاً بك ✨ تم إصدار فاتورة (${typeLabel}) لرحلتك القادمة. يمكنك مراجعة التفاصيل وإتمام الدفع عبر هذا الرابط الآمن: ${params.invoiceUrl.trim()}`;
}

export function buildInvoiceWhatsAppUrl(params: {
  phone?: string | null;
  tripTitle: string;
  invoiceUrl: string;
  amount: number;
  type: InvoiceType;
}): string {
  const message = buildInvoiceWhatsAppMessage(params);
  const encoded = encodeURIComponent(message);
  const digits = formatWhatsAppPhone(String(params.phone ?? '')).replace(/\D/g, '');
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}
