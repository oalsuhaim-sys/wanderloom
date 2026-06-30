'use client'

import { MessageCircle } from 'lucide-react'

import { buildVipButlerWhatsAppUrl } from '@/lib/vip-agency-whatsapp'

type VipButlerFabProps = {
  className?: string
}

export default function VipButlerFab({ className = '' }: VipButlerFabProps) {
  const href = buildVipButlerWhatsAppUrl()

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-24 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37] text-[#1E2720] shadow-[0_8px_28px_rgba(212,175,55,0.45)] transition duration-200 hover:scale-105 hover:shadow-[0_10px_32px_rgba(212,175,55,0.55)] active:scale-95 sm:bottom-28 sm:left-6 sm:h-[3.75rem] sm:w-[3.75rem] ${className}`}
      aria-label="VIP Butler — واتساب الكونسيرج"
      title="VIP Butler"
    >
      <MessageCircle className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
    </a>
  )
}
