'use client'

import { Bookmark, Home, Map } from 'lucide-react'

export type ItineraryMainTab = 'overview' | 'itinerary' | 'bookings'

const TABS: { id: ItineraryMainTab; label: string; Icon: typeof Home }[] = [
  { id: 'overview', label: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629', Icon: Home },
  { id: 'itinerary', label: '\u0627\u0644\u0645\u0633\u0627\u0631', Icon: Map },
  { id: 'bookings', label: '\u062d\u062c\u0648\u0632\u0627\u062a', Icon: Bookmark },
]

type VipItineraryBottomNavProps = {
  activeTab: ItineraryMainTab
  onTabChange: (tab: ItineraryMainTab) => void
}

export default function VipItineraryBottomNav({ activeTab, onTabChange }: VipItineraryBottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d4af37]/25 bg-[#00152e]/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
      aria-label="\u062a\u0646\u0642\u0644 \u0627\u0644\u0631\u062d\u0644\u0629"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 px-2 sm:max-w-xl">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition ${
                active
                  ? 'text-[#d4af37]'
                  : 'text-white/50 hover:bg-[#d4af37]/10 hover:text-white/80'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]' : ''}`}
                strokeWidth={active ? 2.25 : 2}
                aria-hidden
              />
              <span className="text-[10px] font-bold leading-none sm:text-[11px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
