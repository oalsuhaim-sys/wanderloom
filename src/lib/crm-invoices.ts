import { siteOrigin } from '@/lib/bank-checkout';
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions';

export type InvoiceType = 'deposit' | 'full';
/** حالات عمود invoices.status — بما فيها مسار المراجعة القديم في التطبيق */
export type InvoiceStatus =
  | 'pending'
  | 'payment_review'
  | 'paid'
  | 'draft'
  | 'rejected';

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
  receipt_url?: string | null;
  /** سبب رفض الإيصال من الإدارة */
  rejection_reason?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
};

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  deposit: 'عربون',
  full: 'مبلغ كامل',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: 'بانتظار الدفع',
  payment_review: 'بانتظار التحقق',
  paid: 'تم الدفع',
  draft: 'مسودة',
  rejected: 'إيصال مرفوض',
};

/** أسباب رفض سريعة لاعتماد الإيصال البنكي */
export const INVOICE_REJECTION_PRESETS = [
  'صورة غير واضحة',
  'المبلغ ناقص',
  'المبلغ لا يطابق الفاتورة',
  'الحوالة لحساب خاطئ',
  'إيصال مكرر / سبق استخدامه',
] as const;

/** حالات تُحسب كمبالغ بانتظار التحصيل (لا تشمل draft / rejected) */
export const INVOICE_RECEIVABLE_DB_STATUSES = [
  'pending',
  'awaiting_payment',
  'issued',
  'payment_review',
  'awaiting_confirmation',
] as const;

export function isInvoiceReceivableStatus(raw: unknown): boolean {
  const status = parseInvoiceStatus(raw);
  return status === 'pending' || status === 'payment_review';
}

export function parseInvoiceType(raw: unknown): InvoiceType {
  return String(raw ?? '').trim() === 'full' ? 'full' : 'deposit';
}

export function parseInvoiceStatus(raw: unknown): InvoiceStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'paid' || s === 'fully_paid' || s === 'approved') return 'paid';
  if (s === 'payment_review' || s === 'awaiting_confirmation') return 'payment_review';
  if (s === 'draft') return 'draft';
  if (s === 'rejected' || s === 'cancelled' || s === 'canceled' || s === 'void') {
    return 'rejected';
  }
  if (s === 'pending' || s === 'awaiting_payment' || s === 'issued') return 'pending';
  return 'pending';
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
    receipt_url: raw.receipt_url != null ? String(raw.receipt_url).trim() || null : null,
    rejection_reason:
      raw.rejection_reason != null ? String(raw.rejection_reason).trim() || null : null,
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
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** إيرادات محققة: status === paid | approved */
export function isInvoicePaidOrApprovedStatus(raw: unknown): boolean {
  return parseInvoiceStatus(raw) === 'paid';
}

export type InvoiceFinanceMetrics = {
  /** مجموع amount حيث status = paid / approved */
  totalRevenue: number;
  /** مجموع amount حيث status = pending (أو مراجعة دفع) */
  pendingAmount: number;
  totalInvoices: number;
  paidCount: number;
  pendingCount: number;
  draftCount: number;
  rejectedCount: number;
  /** (paidCount / totalInvoices) * 100 */
  paidRatio: number;
};

/**
 * حساب KPIs المالية بدقة من حالات الفاتورة:
 * - إجمالي الإيرادات ← paid / approved فقط
 * - بانتظار الدفع ← pending (+ payment_review كمسار تحصيل)
 * - draft / rejected لا يدخلان في الإيرادات ولا في المستحقات
 */
export function computeInvoiceFinanceMetrics(
  invoices: Array<{ amount?: number | null; status?: unknown }>,
): InvoiceFinanceMetrics {
  let totalRevenue = 0;
  let pendingAmount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let draftCount = 0;
  let rejectedCount = 0;

  for (const inv of invoices) {
    const amount = Math.max(0, Number(inv.amount) || 0);
    const status = parseInvoiceStatus(inv.status);

    if (status === 'paid') {
      totalRevenue += amount;
      paidCount += 1;
      continue;
    }

    if (status === 'pending' || status === 'payment_review') {
      pendingAmount += amount;
      pendingCount += 1;
      continue;
    }

    if (status === 'draft') {
      draftCount += 1;
      continue;
    }

    if (status === 'rejected') {
      rejectedCount += 1;
    }
  }

  const totalInvoices = invoices.length;
  const paidRatio =
    totalInvoices > 0 ? Math.round((paidCount / totalInvoices) * 1000) / 10 : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    totalInvoices,
    paidCount,
    pendingCount,
    draftCount,
    rejectedCount,
    paidRatio,
  };
}

/** Green paid · Amber pending · Gray draft · Red rejected */
export function invoiceStatusBadgeClass(status: InvoiceStatus | string): string {
  const s = parseInvoiceStatus(status);
  if (s === 'paid') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  }
  if (s === 'pending' || s === 'payment_review') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  if (s === 'rejected') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
  }
  // draft (+ fallback)
  return 'bg-slate-100 text-slate-600 dark:bg-[#1A2421] dark:text-slate-400';
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
