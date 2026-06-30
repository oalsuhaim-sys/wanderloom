'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceSearchUrl,
  buildUberDeepLink,
  buildUberRouteDeepLink,
  isCarTransitActivity,
  resolveStopBookingHref,
  type PublicItineraryActivity,
  type PublicItineraryDay,
  type PublicWeatherForecast,
  type VipTransitIconKind,
} from '@/lib/public-itinerary'
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category'

const VIP_OLIVE = '#1E2720'

const TXT_DIRECTIONS = '📍 الاتجاهات'
const TXT_EMPTY_DAYS = 'جاري تنسيق تفاصيل أيام رحلتك'
const TXT_DAY_PREFIX = 'اليوم'
const TXT_TABLIST = 'أيام الرحلة'

function transitModeEmoji(mode: VipTransitIconKind | null | undefined): string {
  if (mode === 'metro') return '🚇'
  if (mode === 'walk') return '🚶'
  return '🚗'
}

function ActivityNotes({ activity }: { activity: PublicItineraryActivity }) {
  const story = activity.story?.trim()
  const note = activity.description?.trim()
  const lines: string[] = []
  if (note) lines.push(note)
  if (story && story !== note) lines.push(story)

  if (lines.length === 0) return null

  return (
    <div className="mt-2 space-y-1.5">
      {lines.map((line, i) => (
        <p
          key={i}
          className="text-xs font-medium leading-relaxed text-gray-600 sm:text-[13px]"
        >
          {line}
        </p>
      ))}
    </div>
  )
}

function CategoryTag({ activity }: { activity: PublicItineraryActivity }) {
  const code = activity.category ?? 'o'
  const meta = getVipPlaceCategoryMeta(code)
  const Icon = meta.Icon

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px] ${meta.accentClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
      <span className="truncate">{activity.categoryLabel ?? meta.label}</span>
    </span>
  )
}

function ActivityActionPills({ activity }: { activity: PublicItineraryActivity }) {
  const placeName = activity.place_name?.trim() || activity.title?.trim() || ''
  const mapsHref =
    activity.googleMapsUrl?.trim() ||
    buildGoogleMapsPlaceSearchUrl(placeName, activity.mapsQuery)

  const bookingRaw = (activity.booking_url ?? activity.bookingUrl ?? '').trim()
  const bookingHref = bookingRaw !== '' ? resolveStopBookingHref(bookingRaw) ?? bookingRaw : null

  const actionBtnClass =
    'flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/50 bg-[#FAFAFA] py-2.5 px-3 text-xs font-bold text-gray-900 transition-colors hover:bg-[#D4AF37]/10 sm:text-sm'

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[#1E2720]/8 pt-3 sm:flex-row">
      <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={actionBtnClass}>
        <MapPin className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
        <span>{TXT_DIRECTIONS}</span>
      </a>
      {bookingRaw !== '' && bookingHref ? (
        <a
          href={bookingHref}
          target="_blank"
          rel="noopener noreferrer"
          className={actionBtnClass}
        >
          <span>🎟️ حجز التذاكر</span>
        </a>
      ) : null}
    </div>
  )
}

function ActivityThumbnail({ activity }: { activity: PublicItineraryActivity }) {
  const url = activity.imageUrl?.trim()

  return (
    <div className="relative h-[160px] w-full shrink-0 overflow-hidden rounded-t-2xl sm:h-full sm:min-h-[200px] sm:rounded-none sm:rounded-s-2xl">
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover shadow-inner"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1E2720]/50 via-[#1E2720]/5 to-transparent" />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1E2720] via-[#2A362C] to-[#1E2720] shadow-inner">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/15 shadow-[0_4px_20px_rgba(212,175,55,0.25)]">
            <MapPin className="h-7 w-7 text-[#D4AF37]" aria-hidden />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]/80">
            Wanderloom
          </span>
        </div>
      )}
    </div>
  )
}

const TIMELINE_DOT_END = '-end-[1.55rem] sm:-end-[1.85rem]'

function DayHotelStartAnchor({
  hotelName,
  mapsQuery,
}: {
  hotelName: string
  mapsQuery: string
}) {
  const mapsHref = buildGoogleMapsPlaceSearchUrl(hotelName, mapsQuery)

  return (
    <div className="relative mb-6">
      <div
        className={`absolute ${TIMELINE_DOT_END} top-4 z-10 h-3 w-3 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]`}
        aria-hidden
      />
      <div className="rounded-xl border border-[#D4AF37]/30 bg-white p-4 shadow-md">
        <span className="text-xs font-bold text-[#D4AF37]">📍 نقطة الانطلاق</span>
        <h3 className="mt-1 text-lg font-bold text-gray-900">{hotelName}</h3>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-gray-600 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900"
        >
          🗺️ عرض على الخريطة
        </a>
      </div>
    </div>
  )
}

function activityPlaceName(activity: PublicItineraryActivity): string {
  return activity.place_name?.trim() || activity.title?.trim() || ''
}

function DayHotelEndAnchor({ hotelName }: { hotelName: string }) {
  const mapsHref = buildGoogleMapsPlaceSearchUrl(hotelName)

  return (
    <div className="relative mt-6">
      <div
        className={`absolute ${TIMELINE_DOT_END} top-4 z-10 h-2.5 w-2.5 rounded-full bg-gray-500`}
        aria-hidden
      />
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-bold text-gray-600">🏁 نهاية المسار (العودة للراحة)</span>
        <h3 className="mt-1 text-lg font-bold text-gray-900">{hotelName}</h3>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-gray-600 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900"
        >
          🗺️ عرض على الخريطة
        </a>
      </div>
    </div>
  )
}

function HotelTransitConnector({
  origin,
  destination,
  directionsLabel,
  uberLabel,
}: {
  origin: string
  destination: string
  directionsLabel: string
  uberLabel: string
}) {
  const directionsHref = buildGoogleMapsDirectionsUrl(origin, destination)
  const uberHref = buildUberDeepLink(destination, { useMyLocationPickup: true })

  return (
    <div className="relative my-2 me-4 border-e-2 border-dashed border-gray-300 py-3">
      <div className="flex w-max max-w-full flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5 text-sm shadow-sm sm:gap-4">
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-gray-600 transition-colors hover:text-gray-900"
        >
          <span className="ms-1.5">🗺️</span>
          {directionsLabel}
        </a>
        <span className="text-gray-700" aria-hidden>
          |
        </span>
        <a
          href={uberHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center font-bold text-[#D4AF37] transition-colors hover:text-[#1E2720]"
        >
          <span className="ms-1.5">🚕</span>
          {uberLabel}
        </a>
      </div>
    </div>
  )
}

function ActivityCarTransitConnector({
  fromName,
  toName,
  duration,
}: {
  fromName: string
  toName: string
  duration?: string
}) {
  const uberHref = buildUberRouteDeepLink(fromName, toName)
  const directionsHref = buildGoogleMapsDirectionsUrl(fromName, toName)

  return (
    <div className="relative my-2 me-4 border-e-2 border-dashed border-gray-300 py-3">
      <div className="flex w-max max-w-full flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:gap-4">
        {duration ? (
          <span className="text-xs font-bold text-gray-600">{duration}</span>
        ) : null}
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <span className="ms-1.5">🗺️</span>
          الاتجاهات
        </a>
        <span className="text-gray-700" aria-hidden>
          |
        </span>
        <a
          href={uberHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center rounded-lg border border-gray-200 bg-white p-2 text-sm font-bold text-[#D4AF37] transition-colors hover:text-[#1E2720]"
        >
          🚕 احجز أوبر للمحطة التالية
        </a>
      </div>
    </div>
  )
}

function ActivityTimelineCard({ activity }: { activity: PublicItineraryActivity }) {
  const timeText = activity.timeLabel?.trim() || null
  const displayName = activity.place_name?.trim() || activity.title?.trim() || 'محطة مميزة'

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-white shadow-md ring-1 ring-gray-100 transition hover:shadow-lg">
      <div className="border-b border-[#D4AF37]/20 bg-gradient-to-l from-[#FAFAFA] to-white px-4 py-2 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryTag activity={activity} />
          {timeText ? (
            <span
              className="shrink-0 rounded-full bg-[#1E2720] px-3 py-1 text-[10px] font-bold tabular-nums text-[#D4AF37]"
              dir="ltr"
            >
              {timeText}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full shrink-0 sm:w-[38%]">
          <ActivityThumbnail activity={activity} />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#1E2720]/40 via-transparent to-transparent sm:block" />
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#D4AF37]">
            محطة مختارة
          </p>
          <h4 className="mt-1 font-serif text-xl font-black leading-snug tracking-tight text-gray-900 sm:text-2xl">
            {displayName}
          </h4>

          {activity.locationLabel ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
              <span>{activity.locationLabel}</span>
            </p>
          ) : null}

          <ActivityNotes activity={activity} />
          <ActivityActionPills activity={activity} />
        </div>
      </div>
    </article>
  )
}

function DayTimeline({ day }: { day: PublicItineraryDay }) {
  const hotelName = day.hotelName?.trim() || ''
  const firstActivity = day.activities[0]
  const lastActivity = day.activities[day.activities.length - 1]
  const firstPlaceName = firstActivity ? activityPlaceName(firstActivity) : ''
  const lastPlaceName = lastActivity ? activityPlaceName(lastActivity) : ''

  return (
    <div className="relative border-e-2 border-[#D4AF37]/50 pe-4 sm:pe-6" dir="rtl">
      {hotelName ? (
        <DayHotelStartAnchor hotelName={hotelName} mapsQuery={day.mapsQuery} />
      ) : null}

      {hotelName && firstPlaceName ? (
        <HotelTransitConnector
          origin={hotelName}
          destination={firstPlaceName}
          directionsLabel="الاتجاهات للمحطة الأولى"
          uberLabel="احجز أوبر"
        />
      ) : null}

      <ul className="space-y-0">
        {day.activities.map((activity, activityIndex) => {
          const showTransit = activityIndex > 0
          const transitDuration = activity.transitDuration?.trim() ?? ''
          const transitMode = activity.transitMode
          const previousActivity = activityIndex > 0 ? day.activities[activityIndex - 1] : null
          const carTransit = showTransit && isCarTransitActivity(activity)

          return (
            <li key={activity.id} className="relative">
              {carTransit ? (
                <ActivityCarTransitConnector
                  fromName={activityPlaceName(previousActivity!)}
                  toName={activityPlaceName(activity)}
                  duration={transitDuration || undefined}
                />
              ) : showTransit && transitDuration !== '' ? (
                <div className="relative flex justify-center py-3">
                  <div
                    className={`absolute ${TIMELINE_DOT_END} top-1/2 z-0 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#D4AF37]`}
                    aria-hidden
                  />
                  <div
                    className="relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D4AF37]/60 bg-white px-3 py-1.5 text-xs font-bold text-gray-900 shadow-sm"
                    aria-label={`انتقال: ${transitDuration}`}
                  >
                    <span aria-hidden>{transitModeEmoji(transitMode)}</span>
                    <span>{transitDuration}</span>
                  </div>
                </div>
              ) : showTransit ? (
                <div className="py-2" aria-hidden />
              ) : null}

              <div className="relative pb-6 last:pb-0">
                <div
                  className={`absolute ${TIMELINE_DOT_END} top-7 z-10 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-[#D4AF37] bg-[#FAFAFA] text-[9px] font-black text-[#1E2720]`}
                  aria-hidden
                >
                  {activityIndex + 1}
                </div>
                <ActivityTimelineCard activity={activity} />
              </div>
            </li>
          )
        })}
      </ul>

      {hotelName && lastPlaceName ? (
        <HotelTransitConnector
          origin={lastPlaceName}
          destination={hotelName}
          directionsLabel="الاتجاهات للفندق"
          uberLabel="احجز أوبر للعودة"
        />
      ) : null}

      {hotelName ? <DayHotelEndAnchor hotelName={hotelName} /> : null}
    </div>
  )
}

type VipDailyItineraryTimelineProps = {
  days: PublicItineraryDay[]
  destination?: string
  tripWeather?: PublicWeatherForecast | null
  mapboxAccessToken?: string
}

export default function VipDailyItineraryTimeline({
  days,
  destination = '',
  tripWeather = null,
}: VipDailyItineraryTimelineProps) {
  const [activeTab, setActiveTab] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab >= days.length && days.length > 0) {
      setActiveTab(0)
    }
  }, [activeTab, days.length])

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-[#D4AF37]/30 bg-white py-12 text-center text-sm font-medium text-gray-600 shadow-sm">
        {TXT_EMPTY_DAYS}…
      </p>
    )
  }

  const safeTab = Math.min(activeTab, days.length - 1)
  const activeDay = days[safeTab]!

  return (
    <div
      className="font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
      dir="rtl"
      style={{ color: VIP_OLIVE }}
    >
      <div className="sticky top-0 z-30 -mx-1 mb-5 border-b border-gray-200 bg-[#FDFBF7]/95 px-1 py-3 backdrop-blur-md">
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
                  e.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest',
                  })
                }}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition duration-200 sm:text-sm ${
                  isActive
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-[#1E2720] shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#D4AF37]/50'
                }`}
              >
                {day.tabLabel}
              </button>
            )
          })}
        </div>
      </div>

      <div key={activeDay.index} role="tabpanel" className="animate-in fade-in duration-300">
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-center shadow-sm sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
            {activeDay.dateLabel || `${TXT_DAY_PREFIX} ${activeDay.index + 1}`}
          </p>
          <h3 className="mt-1.5 text-xl font-black text-gray-900 sm:text-2xl">
            {activeDay.cityLabel?.trim() ? activeDay.tabLabel : activeDay.title}
          </h3>
          <p className="mt-2 text-[11px] font-bold text-gray-500">
            {activeDay.activities.length} محطة مختارة لك
            {activeDay.hotelName?.trim() ? ` · انطلاق وعودة من ${activeDay.hotelName.trim()}` : ''}
          </p>
        </div>

        <DayTimeline day={activeDay} />
      </div>
    </div>
  )
}
