import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeSalesStage, SALES_STAGE_PAYMENT_VERIFYING, SALES_STAGE_PENDING_PAYMENT } from '@/lib/client-sales-stage'
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions'
import { supabase } from '@/lib/supabase'

export const RECEIPTS_BUCKET = 'receipts'
export const PAYMENT_RECEIPTS_BUCKET = 'payment_receipts'

/** Official Alinma transfer details (invoice + checkout fallbacks). */
export const WANDERLOOM_BANK_DETAILS = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME?.trim() || 'مصرف الإنماء',
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME?.trim() || 'عمر عبدالعزيز السحيم',
  iban: process.env.NEXT_PUBLIC_BANK_IBAN?.trim() || 'SA2905000068201801412000',
} as const

/**
 * QR code for bank / STC Pay — file lives at `public/payment-qr.png`.
 * Override with NEXT_PUBLIC_PAYMENT_QR_URL if needed.
 */
export const WANDERLOOM_PAYMENT_QR_SRC =
  process.env.NEXT_PUBLIC_PAYMENT_QR_URL?.trim() || '/payment-qr.png'

export type CheckoutClientProfile = {
  id: string
  name: string
  target_trip: string
  receipt_url: string | null
  sales_stage: string | null
  amount_due?: number | null
  dates_label?: string | null
  destination?: string | null
}

export function siteOrigin(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return ''
}

export function buildCheckoutUrl(clientId: string | number, origin?: string): string {
  const base = siteOrigin(origin)
  if (!base) return `/checkout/${clientId}`
  return `${base}/checkout/${clientId}`
}

export function isClientPendingPayment(stage: string | null | undefined): boolean {
  const s = String(stage ?? '').trim()
  if (!s) return false
  if (normalizeSalesStage(s) === SALES_STAGE_PENDING_PAYMENT) return true
  return s.includes('بانتظار الدفع')
}

export function buildPaymentWhatsAppMessage(params: {
  clientName: string
  targetTrip: string
  checkoutUrl: string
}): string {
  const name = params.clientName.trim() || 'ضيفنا الكريم'
  const trip = params.targetTrip.trim() || 'رحلتك الحصرية'
  return `أهلاً بك أستاذ/ة ${name} 🌟

لتأكيد مقعدك في ${trip} والاستفادة من المزايا الحصرية المخصصة للأوائل، تفضل بزيارة صفحة السداد الخاصة بك لمعرفة تفاصيل الحساب البنكي وإرفاق إيصال التحويل:
${params.checkoutUrl}

الرابط صالحة لمدة ساعتين فقط لضمان تثبيت المقعد المتاح. نسعد بخدمتك وثقتك! 🦅`
}

export function buildPaymentWhatsAppUrl(params: {
  phone: string
  clientName: string
  targetTrip: string
  clientId: string | number
  origin?: string
}): string | null {
  const digits = formatWhatsAppPhone(params.phone)
  if (digits.length < 8) return null

  const checkoutUrl = buildCheckoutUrl(params.clientId, params.origin)
  const message = buildPaymentWhatsAppMessage({
    clientName: params.clientName,
    targetTrip: params.targetTrip,
    checkoutUrl,
  })

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function sanitizeReceiptFileName(name: string): string {
  return name.replace(/[^\w.\-()\u0600-\u06FF\s]/g, '_').replace(/\s+/g, '_')
}

export function receiptPublicUrl(path: string): string {
  const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function fetchCheckoutClient(
  clientId: string,
  db: SupabaseClient = supabase,
): Promise<{ ok: boolean; client: CheckoutClientProfile | null; error?: string }> {
  const id = clientId.trim()
  if (!id) return { ok: false, client: null, error: 'معرّف غير صالح' }

  const queryId = /^\d+$/.test(id) ? Number(id) : id

  // Standard select only — no RPC (get_client_checkout_by_id may be missing from schema cache)
  let { data: direct, error: directError } = await db
    .from('clients')
    .select('id, name, full_name, target_trip, receipt_url, sales_stage')
    .eq('id', queryId)
    .maybeSingle()

  if (directError && /column|schema cache|does not exist/i.test(directError.message ?? '')) {
    const fallback = await db
      .from('clients')
      .select('id, name, sales_stage')
      .eq('id', queryId)
      .maybeSingle()
    direct = fallback.data
      ? ({
          ...fallback.data,
          full_name: null,
          target_trip: null,
          receipt_url: null,
        } as typeof direct)
      : null
    directError = fallback.error
  }

  if (directError || !direct) {
    return {
      ok: false,
      client: null,
      error: directError?.message || 'تعذّر تحميل بيانات الحجز',
    }
  }

  const raw = direct as Record<string, unknown>
  return {
    ok: true,
    client: {
      id: String(raw.id ?? id),
      name: String(raw.name ?? raw.full_name ?? 'ضيفنا الكريم').trim() || 'ضيفنا الكريم',
      target_trip: String(raw.target_trip ?? 'رحلتك الحصرية').trim() || 'رحلتك الحصرية',
      receipt_url: raw.receipt_url ? String(raw.receipt_url) : null,
      sales_stage: raw.sales_stage != null ? String(raw.sales_stage) : null,
    },
  }
}

export async function uploadBankReceipt(
  clientId: string,
  file: File,
  db: SupabaseClient = supabase,
): Promise<{ ok: boolean; publicUrl?: string; error?: string }> {
  const id = clientId.trim()
  if (!id) return { ok: false, error: 'معرّف غير صالح' }

  const allowed =
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    /\.(jpe?g|png|webp|gif|pdf)$/i.test(file.name)

  if (!allowed) {
    return { ok: false, error: 'يرجى رفع صورة (JPG · PNG · WebP) أو ملف PDF' }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'حجم الملف يتجاوز 10 ميجابايت' }
  }

  const path = `clients/${id}/${Date.now()}_${sanitizeReceiptFileName(file.name)}`
  const { error: uploadError } = await db.storage.from(RECEIPTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })

  if (uploadError) {
    return { ok: false, error: uploadError.message }
  }

  return { ok: true, publicUrl: receiptPublicUrl(path) }
}

/**
 * Client-side invoice receipt upload (browser Supabase — do not send File via Server Actions).
 * Tries `payment_receipts`, then falls back to `receipts`.
 */
export async function uploadInvoicePaymentReceipt(
  params: {
    invoiceId: string
    quoteId?: string | null
    file: File
  },
  db: SupabaseClient = supabase,
): Promise<{ ok: boolean; publicUrl?: string; error?: string }> {
  const invoiceId = String(params.invoiceId ?? '').trim()
  const file = params.file
  if (!invoiceId) return { ok: false, error: 'معرّف الفاتورة غير صالح' }
  if (!file || file.size <= 0) return { ok: false, error: 'اختر صورة الحوالة أولاً' }

  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    return { ok: false, error: 'يُقبل رفع الصور فقط (JPG · PNG · WebP)' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'حجم الملف يتجاوز 10 ميجابايت' }
  }

  const quotePart = String(params.quoteId ?? 'unknown').trim() || 'unknown'
  const path = `receipts/${quotePart}/${invoiceId}/${Date.now()}_${sanitizeReceiptFileName(file.name) || 'receipt.jpg'}`
  const contentType = file.type || 'image/jpeg'
  const buckets = [PAYMENT_RECEIPTS_BUCKET, RECEIPTS_BUCKET]

  let lastError = ''
  for (const bucket of buckets) {
    const { error: uploadError } = await db.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    })
    if (uploadError) {
      lastError = uploadError.message
      if (/bucket|not found|does not exist|row-level security|policy|unauthorized/i.test(uploadError.message)) {
        continue
      }
      return { ok: false, error: uploadError.message }
    }
    const { data } = db.storage.from(bucket).getPublicUrl(path)
    const publicUrl = String(data?.publicUrl ?? '').trim()
    if (!publicUrl) return { ok: false, error: 'تعذر الحصول على رابط صورة الحوالة' }
    return { ok: true, publicUrl }
  }

  return {
    ok: false,
    error:
      lastError ||
      'تعذر رفع الصورة — تأكد من إنشاء bucket payment_receipts وتنفيذ invoices_receipt_upload.sql',
  }
}

export async function submitBankReceipt(
  clientId: string,
  receiptUrl: string,
  db: SupabaseClient = supabase,
): Promise<{ ok: boolean; error?: string }> {
  const id = clientId.trim()
  const url = receiptUrl.trim()
  if (!id || !url) return { ok: false, error: 'بيانات غير مكتملة' }

  const queryId = /^\d+$/.test(id) ? Number(id) : id

  // Standard update only — no RPC (submit_client_bank_receipt may be missing)
  const { data: existing } = await db
    .from('clients')
    .select('id, sales_stage')
    .eq('id', queryId)
    .maybeSingle()

  void existing

  const { error: updateError } = await db
    .from('clients')
    .update({
      receipt_url: url,
      sales_stage: SALES_STAGE_PAYMENT_VERIFYING,
    })
    .eq('id', queryId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  return { ok: true }
}
