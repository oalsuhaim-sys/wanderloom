'use client'

export type ItineraryDayViewMode = 'timeline' | 'map'

const TXT_TIMELINE = '\u0627\u0644\u062e\u0637 \u0627\u0644\u0632\u0645\u0646\u064a'
const TXT_MAP = '\u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u062a\u0641\u0627\u0639\u0644\u064a\u0629'

type VipItineraryViewToggleProps = {
  mode: ItineraryDayViewMode
  onChange: (mode: ItineraryDayViewMode) => void
}

export default function VipItineraryViewToggle({ mode, onChange }: VipItineraryViewToggleProps) {
  return (
    <div
      className="mb-4 flex rounded-2xl border border-[#d4af37]/30 bg-[#001f3f]/55 p-1 shadow-[0_0_15px_rgba(212,175,55,0.12)] backdrop-blur-md"
      role="tablist"
      aria-label="\u0639\u0631\u0636 \u0627\u0644\u064a\u0648\u0645"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'timeline'}
        onClick={() => onChange('timeline')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm ${
          mode === 'timeline'
            ? 'bg-[#d4af37] text-[#001f3f] shadow-[0_0_14px_rgba(212,175,55,0.4)]'
            : 'text-[#d4af37]/75 hover:bg-[#d4af37]/10 hover:text-[#d4af37]'
        }`}
      >
        <span aria-hidden>{'\uD83D\uDCC4'}</span>
        <span>{TXT_TIMELINE}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'map'}
        onClick={() => onChange('map')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm ${
          mode === 'map'
            ? 'bg-[#d4af37] text-[#001f3f] shadow-[0_0_14px_rgba(212,175,55,0.4)]'
            : 'text-[#d4af37]/75 hover:bg-[#d4af37]/10 hover:text-[#d4af37]'
        }`}
      >
        <span aria-hidden>{'\uD83D\uDDFA\uFE0F'}</span>
        <span>{TXT_MAP}</span>
      </button>
    </div>
  )
}
