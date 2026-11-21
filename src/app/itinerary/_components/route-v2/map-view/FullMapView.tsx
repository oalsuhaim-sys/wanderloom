'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import type { DaySelection } from '../DayStrip'
import { useItineraryTheme } from '../theme'
import { dayDateParts, RV } from '../route-utils'
import { dayColor } from './day-colors'
import { googleDayRouteLinks } from './google-route'
import { useStopPositions } from './use-stop-positions'

const FullMapLeaflet = dynamic(() => import('./FullMapLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm font-semibold" style={{ color: RV.muted }}>
      جاري تحميل الخريطة…
    </div>
  ),
})

type Props = {
  days: PublicItineraryDay[]
  destination: string
  startDate: string | null
  /** Day to start on (the list view's current day, or the whole trip). */
  initial: DaySelection
  /** Open a day in the list view. */
  onOpenDay: (dayIndex: number) => void
}

/** Map view: every stop of the trip on a real map, one colour per day, with day chips to filter. */
export default function FullMapView({ days, destination, startDate, initial, onOpenDay }: Props) {
  const [filter, setFilter] = useState<DaySelection>(initial)
  const { points, total, pending } = useStopPositions(days, destination)
  const theme = useItineraryTheme()
  const scroller = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])
  // Google allows fewer stops per link on phones
  const [maxPoints, setMaxPoints] = useState(11)
  useEffect(() => {
    const phone = window.matchMedia('(pointer: coarse)').matches
    if (phone) queueMicrotask(() => setMaxPoints(5))
  }, [])

  useEffect(() => {
    const chip = filter === 'all' ? null : chipRefs.current[filter]
    const box = scroller.current
    if (!box) return
    if (!chip) {
      box.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    const c = chip.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    box.scrollBy({ left: c.left + c.width / 2 - (b.left + b.width / 2), behavior: 'smooth' })
  }, [filter])

  const shown = filter === 'all' ? total : (days[filter]?.activities.length ?? 0)
  const placed = filter === 'all' ? points.length : points.filter((p) => p.dayIndex === filter).length
  // re-frame when the filter changes, and once more when the positions finish loading
  const frameKey = `${filter}|${pending === 0 ? 'done' : 'loading'}|${placed > 0 ? 'some' : 'none'}`

  const googleLinks = useMemo(() => {
    if (filter === 'all' || !days[filter]) return []
    const exact = new Map(points.filter((p) => p.dayIndex === filter).map((p) => [p.activity.id, [p.lat, p.lng] as [number, number]]))
    return googleDayRouteLinks(days[filter]!, destination, exact, maxPoints)
  }, [filter, days, destination, points, maxPoints])

  const chipBase =
    'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-all duration-200 active:scale-95'

  return (
    <section aria-label="خريطة الرحلة">
      <div
        ref={scroller}
        className="flex items-center gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={chipBase}
          style={{
            borderColor: filter === 'all' ? RV.gold : RV.line,
            background: filter === 'all' ? RV.gold : RV.card,
            color: filter === 'all' ? RV.onGold : RV.text2,
          }}
        >
          الرحلة كاملة
        </button>
        {days.map((day, i) => {
          const color = dayColor(i)
          const active = filter === i
          const parts = dayDateParts(startDate, i)
          return (
            <button
              key={`map-chip-${day.index}`}
              ref={(el) => {
                chipRefs.current[i] = el
              }}
              type="button"
              onClick={() => setFilter(i)}
              aria-pressed={active}
              className={chipBase}
              style={{
                borderColor: active ? color : RV.line,
                background: active ? color : RV.card,
                color: active ? '#fff' : RV.text2,
                boxShadow: active ? `0 6px 18px ${color}40` : 'none',
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? '#fff' : color }} aria-hidden />
              اليوم {i + 1}
              {parts ? (
                <span className="text-[11px] font-semibold" style={{ opacity: 0.8 }}>
                  {parts.weekdayShort} {parts.dayNum}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="mb-3 mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] font-semibold" style={{ color: RV.muted }}>
        <MapPin className="h-3.5 w-3.5" style={{ color: RV.goldSoft }} aria-hidden />
        <span>{shown} محطة</span>
        {pending > 0 ? <span>· جاري تحديد المواقع…</span> : null}
        {pending === 0 && shown - placed > 0 ? <span>· {shown - placed} بدون موقع دقيق للحين</span> : null}
        {filter !== 'all' && days[filter] ? (
          <button type="button" onClick={() => onOpenDay(filter)} className="ms-auto font-bold underline-offset-4 hover:underline" style={{ color: RV.goldText }}>
            تفاصيل اليوم {filter + 1} ←
          </button>
        ) : null}
      </p>

      {filter !== 'all' && googleLinks.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {googleLinks.map((href, i) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-bold transition-all duration-200 active:scale-95"
              style={{ borderColor: dayColor(filter), color: dayColor(filter), background: RV.card }}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {googleLinks.length === 1 ? `افتح مسار اليوم ${filter + 1} في Google Maps` : `مسار اليوم ${filter + 1} في Google Maps · الجزء ${i + 1} من ${googleLinks.length}`}
            </a>
          ))}
        </div>
      ) : filter === 'all' ? (
        <p className="mb-3 text-[12px] font-semibold" style={{ color: RV.faint }}>
          اختر يوماً لفتح مساره كاملاً في Google Maps.
        </p>
      ) : null}

      <div
        className="relative h-[62vh] min-h-[420px] max-h-[720px] overflow-hidden rounded-[28px] border lg:h-[640px]"
        style={{ borderColor: RV.line, boxShadow: RV.shadow, background: RV.card }}
      >
        <FullMapLeaflet startDate={startDate} points={points} filter={filter} frameKey={frameKey} dark={theme === 'dark'} onOpenDay={onOpenDay} />
        {placed === 0 && pending === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
            <p className="rounded-2xl px-4 py-3 text-center text-sm font-semibold" style={{ background: RV.glassStrong, color: RV.text2 }}>
              مواقع محطات هذا اليوم تُضاف قريباً.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
