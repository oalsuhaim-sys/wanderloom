'use client'

import { MessageCircle } from 'lucide-react'

import { buildPaymentWhatsAppUrl, isClientPendingPayment } from '@/lib/bank-checkout'
import { formatWhatsAppPhone, whatsAppHref } from '@/lib/crm-lead-actions'

type ClientPaymentWhatsAppButtonProps = {
  clientId: string | number
  clientName: string
  phone?: string | null
  targetTrip?: string | null
  salesStage?: string | null
  className?: string
  compact?: boolean
}

export default function ClientPaymentWhatsAppButton({
  clientId,
  clientName,
  phone,
  targetTrip,
  salesStage,
  className = '',
  compact = false,
}: ClientPaymentWhatsAppButtonProps) {
  const phoneDigits = formatWhatsAppPhone(String(phone ?? '').trim())
  if (!phoneDigits) return null

  const pendingPayment = isClientPendingPayment(salesStage)
  const paymentUrl = pendingPayment
    ? buildPaymentWhatsAppUrl({
        phone: phone ?? '',
        clientName,
        targetTrip: targetTrip ?? '',
        clientId,
      })
    : null

  const waUrl = paymentUrl || whatsAppHref(phoneDigits)
  const title = pendingPayment ? 'إرسال رابط الدفع عبر واتساب' : 'فتح واتساب'
  const label = pendingPayment ? 'إرسال رابط الدفع (WhatsApp)' : 'تواصل عبر واتساب'

  if (compact) {
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        aria-label={title}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full p-2 text-emerald-500 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/20 ${className}`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
      </a>
    )
  }

  // Full button: payment CTA only when stage is pending payment
  if (!pendingPayment || !paymentUrl) return null

  return (
    <a
      href={paymentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-l from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-black text-white shadow-[0_8px_24px_rgba(16,185,129,0.28)] transition hover:brightness-105 ${className}`}
      aria-label={label}
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      {label}
    </a>
  )
}
