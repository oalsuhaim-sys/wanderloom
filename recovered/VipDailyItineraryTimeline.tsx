'use client'

import { useEffect, useRef, useState } from 'react'
import { Car, MapPin, Ticket } from 'lucide-react'

import {
  buildUberDeepLink,
  googleMapsSearchUrl,
  type PublicItineraryActivity,
  type PublicItineraryDay,
} from '@/lib/public-itinerary'

const ELLIPSIS = '\u2026'

const ACTIVITY_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#001f3f]/55 shadow-[0_0_15px_rgba(212,175,55,0.35)] backdrop-blur-md'

const TXT_DIRECTIONS = '\u0627\u0644\u0627\u062a\u062c\u0627\u0647\u0627\u062a'
const TXT_UBER = '\u0623\u0648\u0628\u0631'
const TXT_BOOKING = '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062d\u062c\u0632'
const TXT_NO_BOOKING = '\u0644\u0627 \u064a\u0648\u062c\u062f \u0631\u0627\u0628\u0637 \u062d\u062c\u0632'
const TXT_MINUTES = '\u062f\u0642\u064a\u0642'
const TXT_EMPTY_DAYS =
  '\u062c\u0627\u0631\u064a \u062a\u0646\u0633\u064a\u0642 \u062a\u0641\u0627\u0635\u064a\u0644 \u0623\u064a\u0627\u0645 \u0631\u062d\u0644\u062a\u0643'
const TXT_DAY_PREFIX = '\u0627\u0644\u064a\u0648\u0645'
const TXT_TABLIST = '\u0623\u064a\u0627\u0645 \u0627\u0644\u0631\u062d\u0644\u0629'

function TransitBadge({ minutes }: { minutes: number }) {
  return (
    <li className="relative flex justify-end py-2 pe-1" aria-hidden>
      <span className="relative z-10 inline-flex items-center gap-1 rounded-full border border-[#d4af37]/30 bg-[#00152e]/95 px-2.5 py-1 text-[10px] font-bold text-[#d4af37]/90 shadow-sm">
        <span aria-hidden>{'\uD83D\uDE97'}</span>
        <span>
          {minutes} {TXT_MINUTES}
        </span>
      </span>
    </li>
  )
}

function ActivityActionPills({ activity }: { activity: PublicItineraryActivity }) {
  const mapsHref = googleMapsSearchUrl(activity.mapsQuery)
  const uberHref = buildUberDeepLink(activity.mapsQuery)
  const bookingHref = activity.bookingUrl?.trim() || null

  const pillClass =
    'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/45 bg-transparent px-2 py-1.5 text-[10px] font-bold text-[#d4af37] transition hover:border-[#d4af37]/70 hover:bg-[#d4af37]/10 active:scale-[0.98] sm:px-2.5 sm:py-2 sm:text-[11px]'

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
      <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={pillClass}>
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{TXT_DIRECTIONS}</span>
      </a>
      <a href={uberHref} target="_blank" rel="noopener noreferrer" className={pillClass}>
        <Car className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{TXT_UBER}</span>
      </a>
      {bookingHref ? (
        <a href={bookingHref} target="_blank" rel="noopener noreferrer" className={pillClass}>
          <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{TXT_BOOKING}</span>
        </a>
      ) : (
        <span className={`${pillClass} cursor-default opacity-45`} aria-disabled title={TXT_NO_BOOKING}>
          <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{TXT_BOOKING}</span>
        </span>
      )}
    </div>
  )
}

function ActivityThumbnail({ activity }: { activity: PublicItineraryActivity }) {
  const url = activity.imageUrl?.trim()

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-[#002a55] to-[#00152e] shadow-[inset_0_0_12px_rgba(212,175,55,0.12)] sm:h-28 sm:w-28">
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#001f3f]/50 via-transparent to-transparent" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <MapPin className="h-8 w-8 text-[#d4af37]/35" aria-hidden />
        </div>
      )}
    </div>
  )
}

function ActivityTimelineCard({ activity }: { activity: PublicItineraryActivity }) {
  return (
    <article className={ACTIVITY_CARD_CLASS}>
      <div className="flex flex-row gap-3 p-3 sm:gap-4 sm:p-4">
        <ActivityThumbnail activity={activity} />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
            <h4 className="text-sm font-extrabold leading-snug text-[#d4af37] sm:text-base">
              {activity.title}
            </h4>
            <span
              className="shrink-0 rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#d4af37]"
              dir="ltr"
            >
              {activity.timeLabel}
            </span>
          </div>
          {activity.description ? (
            <p className="line-clamp-3 text-xs font-medium leading-relaxed text-white/65 sm:text-sm">
              {activity.description}
            </p>
          ) : null}
          <ActivityActionPills activity={activity} />
        </div>
      </div>
    </article>
  )
}

function DayTimeline({ day }: { day: PublicItineraryDay }) {
  return (
    <div className="relative border-e-2 border-[#d4af37]/30 pe-5 sm:pe-6" dir="rtl">
      <ul className="space-y-0">
        {day.activities.map((activity, activityIndex) => (
          <li key={activity.id} className="relative pb-1 last:pb-0">
            {activityIndex > 0 && activity.transitFromPreviousMinutes != null ? (
              <TransitBadge minutes={activity.transitFromPreviousMinutes} />
            ) : null}

            <div className="relative flex gap-0 pb-5 last:pb-0">
              <div
                className="absolute -end-[1.625rem] top-6 z-10 h-3.5 w-3.5 rounded-full border-2 border-[#d4af37] bg-[#001f3f] shadow-[0_0_8px_rgba(212,175,55,0.55)] sm:-end-[1.875rem]"
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <ActivityTimelineCard activity={activity} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

type VipDailyItineraryTimelineProps = {
  days: PublicItineraryDay[]
}

export default function VipDailyItineraryTimeline({ days }: VipDailyItineraryTimelineProps) {
  const [activeTab, setActiveTab] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab >= days.length && days.length > 0) {
      setActiveTab(0)
    }
  }, [activeTab, days.length])

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#002a55]/60 py-10 text-center text-sm font-medium text-white/60">
        {TXT_EMPTY_DAYS}
        {ELLIPSIS}
      </p>
    )
  }

  const safeTab = Math.min(activeTab, days.length - 1)
  const activeDay = days[safeTab]!

  return (
    <div className="font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
      <div className="sticky top-0 z-30 -mx-1 mb-5 border-b border-[#d4af37]/15 bg-[#001f3f]/92 px-1 py-3 backdrop-blur-md">
        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={TXT_TABLIST}
        >
          {days.map((day, tabIndex) => {
            const isActive = tabIndex === safeTab
            return (
              <button
                key={`day-tab-${day.index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={(e) => {
                  setActiveTab(tabIndex)
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                }}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition duration-200 ${
                  isActive
                    ? 'border-[#d4af37] bg-[#d4af37] text-[#001f3f] shadow-[0_0_14px_rgba(212,175,55,0.45)]'
                    : 'border-[#d4af37]/30 bg-[#002a55]/80 text-white/75 hover:border-[#d4af37]/55 hover:text-white'
                }`}
              >
                {day.tabLabel}
              </button>
            )
          })}
        </div>
      </div>

      <div key={activeDay.index} role="tabpanel" className="transition-opacity duration-300">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37]/75">
            {activeDay.dateLabel || `${TXT_DAY_PREFIX} ${activeDay.index + 1}`}
          </p>
          <h3 className="mt-1 text-xl font-black text-white">{activeDay.title}</h3>
          {activeDay.cityLabel ? (
            <p className="mt-1 text-sm font-medium text-white/50">{activeDay.cityLabel}</p>
          ) : null}
        </div>

        <DayTimeline day={activeDay} />
      </div>
    </div>
  )
}
