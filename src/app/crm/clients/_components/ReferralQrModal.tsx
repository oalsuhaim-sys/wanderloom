'use client'

import { useEffect } from 'react'
import { QrCode, X } from 'lucide-react'

import ReferralQrCard from '@/app/crm/clients/_components/ReferralQrCard'

type ReferralQrModalProps = {
  open: boolean
  onClose: () => void
  referralCode: string
  clientName?: string
}

export default function ReferralQrModal({
  open,
  onClose,
  referralCode,
  clientName,
}: ReferralQrModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !referralCode.trim()) return null

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-[#001f3f]/45 p-0 backdrop-blur-sm sm:p-4"
      dir="rtl"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-qr-modal-title"
        className="w-full max-w-sm rounded-t-3xl border border-stone-100 bg-[#FBFBF9] p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 text-right">
            <h2
              id="referral-qr-modal-title"
              className="inline-flex items-center gap-2 text-sm font-black text-[#1c3d27]"
            >
              <QrCode className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              باركود الإحالة
            </h2>
            {clientName ? (
              <p className="mt-1 truncate text-xs text-stone-500">{clientName}</p>
            ) : null}
            <p className="mt-1 font-mono text-[11px] font-bold text-[#1c3d27]" dir="ltr">
              {referralCode.trim()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <ReferralQrCard referralCode={referralCode} />
      </div>
    </div>
  )
}
