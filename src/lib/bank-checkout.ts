import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeSalesStage, SALES_STAGE_CONFIRMED, SALES_STAGE_PENDING_PAYMENT } from '@/lib/client-sales-stage'
import { formatWhatsAppPhone } from '@/lib/crm-lead-actions'
import { supabase } from '@/lib/supabase'

export const RECEIPTS_BUCKET = 'receipts'

export const WANDERLOOM_BANK_DETAILS = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME?.trim() || '[أدخل اسم البنك]',
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME?.trim() || '[أدخل اسم المؤسسة]',
  iban: process.env.NEXT_PUBLIC_BANK_IBAN?.trim() || 'SA0000000000000000000000',
} as const

/**
 * QR code for bank / STC Pay — replace the file at this path in `public/`.
 * Example: add `public/payment-qr.png` and set NEXT_PUBLIC_PAYMENT_QR_URL=/payment-qr.png
 */
export const WANDERLOOM_PAYMENT_QR_SRC =
  process.env.NEXT_PUBLIC_PAYMENT_QR_URL?.trim() || '/payment-qr.png'

export type CheckoutClientProfile = {
  id: string
  name: string
  target_trip: string
  receipt_url: string | null
  sales_stage: string | null
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

  const { data, error } = await db.rpc('get_client_checkout_by_id', { p_client_id: id })

  if (!error && data && typeof data === 'object') {
    const row = data as Record<string, unknown>
    return {
      ok: true,
      client: {
        id: String(row.id ?? id),
        name: String(row.name ?? 'ضيفنا الكريم'),
        target_trip: String(row.target_trip ?? 'رحلتك الحصرية'),
        receipt_url: row.receipt_url ? String(row.receipt_url) : null,
        sales_stage: row.sales_stage != null ? String(row.sales_stage) : null,
      },
    }
  }

  const { data: direct, error: directError } = await db
    .from('clients')
    .select('id, name, full_name, target_trip, receipt_url, sales_stage')
    .eq('id', id)
    .maybeSingle()

  if (directError || !direct) {
    return {
      ok: false,
      client: null,
      error: error?.message || directError?.message || 'تعذّر تحميل بيانات الحجز',
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

export async function submitBankReceipt(
  clientId: string,
  receiptUrl: string,
  db: SupabaseClient = supabase,
): Promise<{ ok: boolean; error?: string }> {
  const id = clientId.trim()
  const url = receiptUrl.trim()
  if (!id || !url) return { ok: false, error: 'بيانات غير مكتملة' }

  const { data, error } = await db.rpc('submit_client_bank_receipt', {
    p_client_id: id,
    p_receipt_url: url,
  })

  if (!error && data === true) {
    return { ok: true }
  }

  const { error: updateError } = await db
    .from('clients')
    .update({
      receipt_url: url,
      sales_stage: SALES_STAGE_CONFIRMED,
    })
    .eq('id', id)

  if (updateError) {
    return { ok: false, error: error?.message || updateError.message }
  }

  return { ok: true }
}
