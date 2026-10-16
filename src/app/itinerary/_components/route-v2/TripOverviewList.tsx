'use client'

import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import { cityOf, dayDateParts, placeName, RV } from './route-utils'

type Props = {
  days: PublicItineraryDay[]
  startDate: string | null
  destination: string
  today: number | null
  cityColors: Map<string, string>
  onSelectDay: (i: number) => void
}

/** «الرحلة كاملة»: every day at a glance, tap to jump in. */
export default function TripOverviewList({ days, startDate, destination, today, cityColors, onSelectDay }: Props) {
  return (
    <section className="rounded-[24px] border p-2" style={{ borderColor: RV.line, background: RV.card }} dir="rtl">
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <div>
          <h3 className="text-[22px] font-black" style={{ color: RV.cream }}>
            الرحلة كاملة
          </h3>
          <p className="text-xs font-semibold" style={{ color: RV.muted }}>
            اضغط أي يوم وتروح له
          </p>
        </div>
        <span className="rounded-xl border-2 px-3 py-1 text-sm font-black" style={{ borderColor: RV.gold, color: RV.gold }}>
          {days.length} يوم
        </span>
      </header>
      <ol>
        {days.map((d, i) => {
          const parts = dayDateParts(startDate, i)
          const city = cityOf(d, destination)
          const color = cityColors.get(city) ?? RV.gold
          const names = d.activities.slice(0, 3).map(placeName).join(' · ')
          return (
            <motion.li
              key={`ov-${d.index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}
              className="list-none border-t first:border-t-0"
              style={{ borderColor: RV.line }}
            >
              <button type="button" onClick={() => onSelectDay(i)} className="flex w-full items-center gap-3 px-3 py-3.5 text-right transition active:scale-[0.99]">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black tabular-nums"
                  style={{ borderColor: color, color }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold" style={{ color: today === i ? RV.gold : RV.cream }}>
                      {parts?.long ?? `اليوم ${i + 1}`}
                    </span>
                    {today === i ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: RV.gold, color: '#141C17' }}>
                        اليوم
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: RV.muted }}>
                    <span style={{ color }}>{city}</span>
                    {names ? ` · ${names}` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border px-2 py-1 text-[11px] font-bold" style={{ borderColor: RV.line, color: RV.muted }}>
                  {d.activities.length} أماكن
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: RV.muted }} aria-hidden />
              </button>
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}
