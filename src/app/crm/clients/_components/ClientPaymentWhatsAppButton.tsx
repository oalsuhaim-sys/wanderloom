'use client'

import { MessageCircle } from 'lucide-react'

import { buildPaymentWhatsAppUrl, isClientPendingPayment } from '@/lib/bank-checkout'

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
  if (!isClientPendingPayment(salesStage)) return null

  const waUrl = buildPaymentWhatsAppUrl({
    phone: phone ?? '',
    clientName,
    targetTrip: targetTrip ?? '',
    clientId,
  })

  if (!waUrl) return null

  if (compact) {
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-950/20 px-3 py-1.5 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-50 ${className}`}
      >
        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        رابط الدفع
      </a>
    )
  }

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-l from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-black text-white shadow-[0_8px_24px_rgba(16,185,129,0.28)] transition hover:brightness-105 ${className}`}
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
      إرسال رابط الدفع (WhatsApp)
    </a>
  )
}
