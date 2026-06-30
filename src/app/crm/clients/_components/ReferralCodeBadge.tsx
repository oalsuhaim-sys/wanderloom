'use client'

import { Copy, QrCode } from 'lucide-react'

type ReferralCodeBadgeProps = {
  code: string
  label?: string
  onCopy: () => void
  onOpenQr: () => void
  className?: string
}

/** شارة مدمجة لكود الإحالة — للبطاقة الخارجية في الشبكة */
export default function ReferralCodeBadge({
  code,
  label = 'كود الإحالة',
  onCopy,
  onOpenQr,
  className = '',
}: ReferralCodeBadgeProps) {
  const trimmed = code.trim()
  if (!trimmed) return null

  return (
    <div
      className={`mt-3 inline-flex max-w-full items-center gap-1 rounded-full border border-[#d4af37]/20 bg-white/90 px-2.5 py-1 shadow-sm ${className}`}
      dir="rtl"
    >
      <span className="shrink-0 text-[10px] font-bold text-[#001f3f]/65">{label}:</span>
      <code className="min-w-0 truncate font-mono text-[11px] font-bold text-[#1c3d27]" dir="ltr">
        {trimmed}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#001f3f]/70 transition hover:bg-stone-100 hover:text-[#001f3f]"
        title="نسخ الكود"
        aria-label="نسخ كود الإحالة"
      >
        <Copy className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onOpenQr}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1c3d27]/8 text-[#1c3d27] transition hover:bg-[#1c3d27]/15"
        title="عرض الباركود"
        aria-label="عرض باركود الإحالة"
      >
        <QrCode className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}
