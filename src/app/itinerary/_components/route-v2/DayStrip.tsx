'use client'

import { useEffect, useRef } from 'react'
import { Layers } from 'lucide-react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import { cityOf, dayDateParts, RV } from './route-utils'

export type DaySelection = number | 'all'

type DayStripProps = {
  days: PublicItineraryDay[]
  startDate: string | null
  destination: string
  selected: DaySelection
  today: number | null
  cityColors: Map<string, string>
  onSelect: (s: DaySelection) => void
}

/** Sticky, horizontally scrolling day picker (+ «الرحلة كاملة»). */
export default function DayStrip({ days, startDate, destination, selected, today, cityColors, onSelect }: DayStripProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (selected === 'all') {
      scroller.current?.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    chipRefs.current[selected]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selected])

  // show the month name before the first day of each month
  const monthStarts = days.map((_, i) => {
    const cur = dayDateParts(startDate, i)
    const prev = i > 0 ? dayDateParts(startDate, i - 1) : null
    return Boolean(cur && (!prev || prev.monthIndex !== cur.monthIndex))
  })

  return (
    <nav
      className="sticky top-0 z-40 -mx-4 border-b px-4 pb-3 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
      style={{ background: 'rgba(20,28,23,0.88)', borderColor: RV.line }}
      aria-label="أيام الرحلة"
    >
      <div
        ref={scroller}
        className="flex items-stretch gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={() => onSelect('all')}
          aria-pressed={selected === 'all'}
          className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-[11px] font-bold leading-tight transition-all duration-200 active:scale-95"
          style={{
            borderColor: selected === 'all' ? RV.gold : RV.line,
            background: selected === 'all' ? 'rgba(212,175,55,0.14)' : RV.card,
            color: selected === 'all' ? RV.gold : RV.muted,
          }}
        >
          <Layers className="h-5 w-5" aria-hidden />
          <span>الرحلة كاملة</span>
        </button>

        {days.map((day, i) => {
          const parts = dayDateParts(startDate, i)
          const city = cityOf(day, destination)
          const color = cityColors.get(city) ?? RV.gold
          const active = selected === i
          const isToday = today === i
          const showMonth = monthStarts[i]
          return (
            <div key={`strip-${day.index}`} className="flex shrink-0 items-stretch gap-2">
              {showMonth ? (
                <span
                  className="flex items-center text-[11px] font-black tracking-wide"
                  style={{ color: RV.goldSoft, writingMode: 'vertical-rl' }}
                  aria-hidden
                >
                  {parts!.month}
                </span>
              ) : null}
              <button
                ref={(el) => {
                  chipRefs.current[i] = el
                }}
                type="button"
                onClick={() => onSelect(i)}
                aria-pressed={active}
                aria-label={`${parts?.long ?? `اليوم ${i + 1}`} · ${city}`}
                className="relative flex w-[60px] flex-col items-center rounded-2xl border pb-2 pt-1.5 transition-all duration-200 active:scale-95"
                style={{
                  borderColor: active ? RV.gold : RV.line,
                  background: active ? 'linear-gradient(180deg,rgba(212,175,55,0.18),rgba(212,175,55,0.04))' : RV.card,
                  boxShadow: active ? '0 6px 20px rgba(212,175,55,0.18)' : 'none',
                }}
              >
                <span className="h-3 text-[10px] font-bold" style={{ color: isToday ? RV.gold : 'transparent' }}>
                  {isToday ? 'اليوم' : '.'}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: active ? RV.cream : RV.muted }}>
                  {parts?.weekdayShort ?? 'يوم'}
                </span>
                <span
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-[19px] font-black tabular-nums"
                  style={{
                    color: active ? '#141C17' : RV.cream,
                    background: active ? RV.gold : 'transparent',
                  }}
                >
                  {parts?.dayNum ?? i + 1}
                </span>
                <span className="mt-1.5 h-[3px] w-6 rounded-full" style={{ background: color, opacity: active ? 1 : 0.7 }} />
              </button>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
