'use client'

type ClientTargetTripBadgeProps = {
  label: string
  className?: string
}

/** شارة الرحلة المستهدفة — pill داكن فاخر */
export default function ClientTargetTripBadge({ label, className = '' }: ClientTargetTripBadgeProps) {
  const text = label.trim()
  if (!text) return null

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-700/90 bg-gray-800 px-3 py-1 text-[11px] font-bold text-[#d4af37]/90 shadow-sm ${className}`}
      title={`الرحلة المستهدفة: ${text}`}
    >
      <span aria-hidden className="shrink-0 text-[12px] leading-none">
        🏷️
      </span>
      <span className="truncate">{text}</span>
    </span>
  )
}
