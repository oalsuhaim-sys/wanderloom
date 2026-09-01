'use client'

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Camera,
  BedDouble,
  MapPin,
  Plane,
  Ticket,
} from 'lucide-react'

import { calculateTripCountdown } from '@/lib/client-teaser-portal'
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceSearchUrl,
  buildUberDeepLink,
  buildUberRouteDeepLink,
  formatTripDateRange,
  isCarTransitActivity,
  resolveStopBookingHref,
  type PublicItineraryActivity,
  type PublicItineraryDay,
  type PublicWeatherForecast,
  type VipTransitIconKind,
} from '@/lib/public-itinerary'
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category'
import DayWeatherPill from './DayWeatherPill'

const TXT_EMPTY_DAYS = 'جاري تنسيق تفاصيل أيام رحلتك'
const TXT_DAY_PREFIX = 'اليوم'

function transitModeEmoji(mode: VipTransitIconKind | null | undefined): string {
  if (mode === 'metro') return '🚇'
  if (mode === 'walk') return '🚶'
  return '🚗'
}

function activityPlaceName(activity: PublicItineraryActivity): string {
  return activity.place_name?.trim() || activity.title?.trim() || ''
}

function activityContextIcon(activity: PublicItineraryActivity) {
  const code = String(activity.category ?? '').toLowerCase()
  const title = `${activity.title} ${activity.place_name ?? ''}`.toLowerCase()
  if (code === 'h' || /فندق|hotel|resort/.test(title)) return BedDouble
  if (/طيران|flight|airport|مطار|boarding/.test(title)) return Plane
  return getVipPlaceCategoryMeta(activity.category ?? 'o').Icon
}

function formatTimeDisplay(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(text)
  if (!m) return text
  const hour = Number(m[1])
  const minute = m[2]
  if (!Number.isFinite(hour)) return text
  const period = hour >= 12 ? 'م' : 'ص'
  const h12 = hour % 12 || 12
  return `${h12}:${minute} ${period}`
}

function countdownPillLabel(startDate: string | null | undefined): string | null {
  if (!startDate) return null
  const parts = calculateTripCountdown(startDate)
  if (parts.started) return 'الرحلة جارية الآن'
  if (parts.days <= 0) {
    if (parts.hours > 0) return `تبدأ بعد ${parts.hours} ساعة`
    return 'تبدأ قريباً'
  }
  if (parts.days === 1) return 'تبدأ غداً'
  return `تبدأ بعد ${parts.days} أيام`
}

function ActivityNotes({ activity }: { activity: PublicItineraryActivity }) {
  const stopNotes = activity.notes?.trim()
  const story = activity.story?.trim()
  const note = activity.description?.trim()
  const lines: string[] = []
  if (note && note !== stopNotes) lines.push(note)
  if (story && story !== note && story !== stopNotes) lines.push(story)

  return (
    <>
      {stopNotes ? (
        <div className="mt-1 flex items-center gap-1 rounded border border-amber-100/50 bg-amber-50/50 p-1.5 text-xs text-gray-500">
          <span aria-hidden>💡</span>
          <span>{stopNotes}</span>
        </div>
      ) : null}
      {lines.length > 0 ? (
        <div className="mt-1 space-y-1">
          {lines.map((line, i) => (
            <p
              key={i}
              className="line-clamp-2 text-sm font-medium leading-relaxed text-gray-500 transition-all group-hover:line-clamp-none"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </>
  )
}

function CategoryTag({ activity }: { activity: PublicItineraryActivity }) {
  const meta = getVipPlaceCategoryMeta(activity.category ?? 'o')
  const Icon = meta.Icon

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px] ${meta.accentClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" aria-hidden />
      <span className="truncate">{activity.categoryLabel ?? meta.label}</span>
    </span>
  )
}

function MapsPinLink({ href }: { href: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#C5A059]/25 bg-[#F9F9F6] text-[#C5A059] transition-all duration-200 hover:scale-110 hover:border-[#C5A059]/50 hover:bg-[#1A3B2A] hover:text-[#C5A059]"
      title="عرض المكان على الخريطة"
      aria-label="عرض المكان على الخريطة"
    >
      <MapPin className="h-4 w-4" aria-hidden />
    </a>
  )
}

function ActivityActionPills({
  activity,
  tripId,
  magicLinkId,
  clientId,
  memoryUploadingId,
  onUploadStart,
  onUploadEnd,
}: {
  activity: PublicItineraryActivity
  tripId: string
  magicLinkId?: string | null
  clientId?: string | number | null
  memoryUploadingId?: string | null
  onUploadStart?: (activityId: string) => void
  onUploadEnd?: () => void
}) {
  const placeName = activity.place_name?.trim() || activity.title?.trim() || ''
  const mapsHref =
    activity.googleMapsUrl?.trim() ||
    buildGoogleMapsPlaceSearchUrl(placeName, activity.mapsQuery)

  const bookingRaw = (activity.booking_url ?? activity.bookingUrl ?? '').trim()
  const bookingHref = bookingRaw !== '' ? resolveStopBookingHref(bookingRaw) ?? bookingRaw : null
  const uploadInputId = `upload-memory-${activity.id}`
  const isUploading = memoryUploadingId === activity.id

  const resolvedTripId = String(tripId ?? '').trim().replace(/^(client-|vip-)/i, '')
  const resolvedMagicLinkId = String(magicLinkId ?? '').trim()
  const resolvedClientId =
    clientId != null && String(clientId).trim() !== ''
      ? String(clientId).trim().replace(/^(client-|vip-)/i, '')
      : ''
  const canUpload = Boolean(resolvedTripId)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !resolvedTripId) return

    const locationName =
      activity.title?.trim() ||
      activity.place_name?.trim() ||
      activity.locationLabel?.trim() ||
      'محطة مختارة'

    onUploadStart?.(activity.id)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('locationName', locationName)
      if (mapsHref) {
        formData.append('mapUrl', mapsHref)
        formData.append('map_url', mapsHref)
        formData.append('google_maps_url', mapsHref)
      }
      formData.append('trip_id', resolvedTripId)
      formData.append('itinerary_id', resolvedTripId)
      formData.append('itineraryId', resolvedTripId)
      formData.append('tripId', resolvedTripId)
      if (resolvedClientId) {
        formData.append('client_id', resolvedClientId)
        formData.append('clientId', resolvedClientId)
      }
      if (resolvedMagicLinkId) {
        formData.append('magic_link_id', resolvedMagicLinkId)
        formData.append('magicLinkId', resolvedMagicLinkId)
      }

      const response = await fetch('/api/client-upload', {
        method: 'POST',
        body: formData,
      })

      const result = (await response.json()) as { error?: unknown }
      if (!response.ok) {
        let errorDetail = result.error
        if (typeof errorDetail === 'object' && errorDetail != null) {
          errorDetail = JSON.stringify(errorDetail)
        }
        throw new Error(String(errorDetail || '').trim() || 'حدث خطأ غير معروف في الخادم')
      }

      window.alert('تم رفع الصورة بنجاح! ستظهر في مكتبة الذكريات لدى الإدارة للاعتماد. 📸')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error != null
            ? JSON.stringify(error)
            : String(error)
      window.alert(`فشل الرفع:\n${message}`)
    } finally {
      onUploadEnd?.()
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
      <MapsPinLink href={mapsHref} />

      {bookingRaw !== '' && bookingHref ? (
        <a
          href={bookingHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#C5A059]/30 bg-[#F9F9F6] px-3 py-2 text-xs font-bold text-[#1A3B2A] transition hover:border-[#C5A059]/50 hover:bg-[#1A3B2A] hover:text-white"
        >
          <Ticket className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden />
          التذاكر
        </a>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (!canUpload) return
          document.getElementById(uploadInputId)?.click()
        }}
        disabled={isUploading || !canUpload}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-[#C5A059]/30 hover:text-[#1A3B2A] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera className="h-3.5 w-3.5" aria-hidden />
        {isUploading ? 'جاري الرفع…' : !canUpload ? 'بانتظار التأكيد' : 'وثّق اللحظة'}
      </button>

      {canUpload ? (
        <input
          type="file"
          id={uploadInputId}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => void handleFileChange(e)}
        />
      ) : null}
    </div>
  )
}

function DayHotelStartAnchor({
  hotelName,
  mapsQuery,
}: {
  hotelName: string
  mapsQuery: string
}) {
  const mapsHref = buildGoogleMapsPlaceSearchUrl(hotelName, mapsQuery)

  return (
    <div className="mb-4 rounded-2xl border border-[#C5A059]/20 bg-white p-4 shadow-sm">
      <span className="text-xs font-bold text-[#C5A059]">نقطة الانطلاق</span>
      <h3 className="mt-1 text-base font-bold text-[#1A3B2A]">{hotelName}</h3>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 underline decoration-gray-200 underline-offset-4 transition hover:text-[#C5A059]"
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        عرض على الخريطة
      </a>
    </div>
  )
}

function DayHotelEndAnchor({ hotelName }: { hotelName: string }) {
  const mapsHref = buildGoogleMapsPlaceSearchUrl(hotelName)

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="text-xs font-bold text-gray-500">نهاية المسار · العودة للراحة</span>
      <h3 className="mt-1 text-base font-bold text-[#1A3B2A]">{hotelName}</h3>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 underline decoration-gray-200 underline-offset-4 transition hover:text-[#C5A059]"
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        عرض على الخريطة
      </a>
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
    <div className="my-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white/80 px-3 py-2.5 text-sm shadow-sm">
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-gray-600 transition hover:text-[#1A3B2A]"
      >
        {directionsLabel}
      </a>
      <span className="text-gray-300" aria-hidden>
        |
      </span>
      <a
        href={uberHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-[#C5A059] transition hover:text-[#1A3B2A]"
      >
        {uberLabel}
      </a>
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
    <div className="my-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#C5A059]/30 bg-[#F9F9F6] px-3 py-2.5 text-sm">
      {duration ? (
        <span className="text-xs font-bold text-gray-500">{duration}</span>
      ) : null}
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-gray-600 transition hover:text-[#1A3B2A]"
      >
        الاتجاهات
      </a>
      <a
        href={uberHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-[#C5A059] transition hover:text-[#1A3B2A]"
      >
        احجز أوبر للمحطة التالية
      </a>
    </div>
  )
}

function ActivityTimelineCard({
  activity,
  tripId,
  magicLinkId,
  clientId,
  memoryUploadingId,
  onUploadStart,
  onUploadEnd,
}: {
  activity: PublicItineraryActivity
  tripId: string
  magicLinkId?: string | null
  clientId?: string | number | null
  memoryUploadingId?: string | null
  onUploadStart?: (activityId: string) => void
  onUploadEnd?: () => void
}) {
  const timeText = formatTimeDisplay(activity.timeLabel)
  const displayName = activity.place_name?.trim() || activity.title?.trim() || 'محطة مميزة'
  const ContextIcon = activityContextIcon(activity)
  const thumb = activity.imageUrl?.trim()

  return (
    <article className="group relative mb-4 flex flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:border-[#C5A059]/30 hover:shadow-md sm:flex-row">
      {/* Time / icon column */}
      <div className="flex min-w-[80px] flex-row items-center justify-center gap-3 border-b border-gray-100 pb-4 sm:flex-col sm:border-b-0 sm:border-l sm:pb-0 sm:pl-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A3B2A]/5 text-[#C5A059]">
          <ContextIcon className="h-5 w-5" aria-hidden />
        </div>
        {timeText ? (
          <span className="text-sm font-black tabular-nums text-[#1A3B2A]" dir="ltr">
            {timeText}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-gray-400">وقت مرن</span>
        )}
      </div>

      {/* Optional thumbnail */}
      {thumb ? (
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl sm:h-auto sm:w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : null}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CategoryTag activity={activity} />
          {activity.locationLabel ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400">
              <MapPin className="h-3 w-3 text-[#C5A059]" aria-hidden />
              {activity.locationLabel}
            </span>
          ) : null}
        </div>

        <h4 className="text-lg font-bold text-gray-800">{displayName}</h4>
        <ActivityNotes activity={activity} />

        <ActivityActionPills
          activity={activity}
          tripId={tripId}
          magicLinkId={magicLinkId}
          clientId={clientId}
          memoryUploadingId={memoryUploadingId}
          onUploadStart={onUploadStart}
          onUploadEnd={onUploadEnd}
        />
      </div>
    </article>
  )
}

function DayBlock({
  day,
  dayIndex,
  destination,
  startDate,
  tripId,
  magicLinkId,
  clientId,
  memoryUploadingId,
  onUploadStart,
  onUploadEnd,
}: {
  day: PublicItineraryDay
  dayIndex: number
  destination: string
  startDate: string | null
  tripId: string
  magicLinkId?: string | null
  clientId?: string | number | null
  memoryUploadingId?: string | null
  onUploadStart?: (activityId: string) => void
  onUploadEnd?: () => void
}) {
  const hotelName = day.hotelName?.trim() || ''
  const firstActivity = day.activities[0]
  const lastActivity = day.activities[day.activities.length - 1]
  const firstPlaceName = firstActivity ? activityPlaceName(firstActivity) : ''
  const lastPlaceName = lastActivity ? activityPlaceName(lastActivity) : ''
  const dayTitle = day.cityLabel?.trim()
    ? day.tabLabel || day.title
    : day.title || `${TXT_DAY_PREFIX} ${day.index + 1}`

  return (
    <section id={`day-${dayIndex}`} className="relative scroll-mt-28">
      <div
        className="absolute -right-[41px] top-1.5 z-10 h-5 w-5 rounded-full border-[3px] border-[#C5A059] bg-[#1A3B2A] shadow-[0_0_10px_rgba(197,160,89,0.5)] md:-right-[49px]"
        aria-hidden
      />

      <header className="mb-6 flex flex-wrap items-center gap-3 pr-2">
        <h3 className="text-2xl font-bold text-[#1A3B2A]">{dayTitle}</h3>
        {day.dateLabel ? (
          <span className="rounded-full border border-[#C5A059]/20 bg-white px-3 py-1 text-xs font-bold text-[#C5A059]">
            {day.dateLabel}
          </span>
        ) : null}
        <DayWeatherPill
          city={day.cityLabel}
          destination={destination}
          startDate={startDate}
          dayIndex={dayIndex}
        />
        <span className="text-xs font-semibold text-gray-400">
          {day.activities.length} محطة
        </span>
      </header>

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
            <li key={activity.id}>
              {carTransit ? (
                <ActivityCarTransitConnector
                  fromName={activityPlaceName(previousActivity!)}
                  toName={activityPlaceName(activity)}
                  duration={transitDuration || undefined}
                />
              ) : showTransit && transitDuration !== '' ? (
                <div className="flex justify-center py-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#C5A059]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#1A3B2A] shadow-sm">
                    <span aria-hidden>{transitModeEmoji(transitMode)}</span>
                    <span>{transitDuration}</span>
                  </div>
                </div>
              ) : showTransit ? (
                <div className="py-2" aria-hidden />
              ) : null}

              <ActivityTimelineCard
                activity={activity}
                tripId={tripId}
                magicLinkId={magicLinkId}
                clientId={clientId}
                memoryUploadingId={memoryUploadingId}
                onUploadStart={onUploadStart}
                onUploadEnd={onUploadEnd}
              />
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
    </section>
  )
}

import { resolveDestinationCoverImage } from '@/lib/destination-cover-image'

function resolveHeroCoverUrl(
  coverImage: string | null | undefined,
  destination: string,
  days: PublicItineraryDay[] = [],
): string {
  const primary = String(coverImage ?? '').trim()
  if (primary) return primary

  for (const day of days) {
    for (const activity of day.activities) {
      const img = activity.imageUrl?.trim()
      if (img) return img
    }
  }

  return resolveDestinationCoverImage(destination, { width: 1200 })
}

function LuxuryItineraryHero({
  title,
  destination,
  coverImage,
  days,
  dateRangeLabel,
  startDate,
}: {
  title: string
  destination: string
  coverImage: string | null
  days: PublicItineraryDay[]
  dateRangeLabel: string
  startDate: string | null
}) {
  const pill = useMemo(() => countdownPillLabel(startDate), [startDate])
  const headline = title.trim() || destination.trim() || 'مسار رحلتك'
  const resolvedCover = useMemo(
    () => resolveHeroCoverUrl(coverImage, destination, days),
    [coverImage, destination, days],
  )

  return (
    <section
      className="relative mb-10 h-40 overflow-hidden rounded-3xl shadow-lg md:h-56"
      style={{
        backgroundImage: `url(${resolvedCover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A3B2A] via-[#1A3B2A]/60 to-black/20" />

      <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 md:p-8">
        {destination && destination !== headline ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#C5A059]">
            {destination}
          </p>
        ) : null}
        <h2 className="mt-1 text-3xl font-bold text-white drop-shadow-md md:text-4xl">
          {headline}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dateRangeLabel ? (
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur-md">
              {dateRangeLabel}
            </span>
          ) : null}
          {pill ? (
            <span className="rounded-full border border-[#C5A059]/40 bg-[#C5A059]/15 px-3 py-1 text-xs font-bold text-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.25)] backdrop-blur-md">
              {pill}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type VipDailyItineraryTimelineProps = {
  days: PublicItineraryDay[]
  destination?: string
  tripTitle?: string
  coverImage?: string | null
  startDate?: string | null
  endDate?: string | null
  dateRangeLabel?: string
  tripWeather?: PublicWeatherForecast | null
  mapboxAccessToken?: string
  tripId: string | number
  itineraryId?: string | number
  magicLinkId?: string | null
  clientId?: string | number | null
  /** Optional slot under the hero (e.g. pre-trip services) */
  heroFooter?: ReactNode
}

export default function VipDailyItineraryTimeline({
  days,
  destination = '',
  tripTitle = '',
  coverImage = null,
  startDate = null,
  endDate = null,
  dateRangeLabel,
  tripId,
  itineraryId,
  magicLinkId = null,
  clientId,
  heroFooter,
}: VipDailyItineraryTimelineProps) {
  const [memoryUploadingId, setMemoryUploadingId] = useState<string | null>(null)
  const [activeDayNav, setActiveDayNav] = useState(0)
  const resolvedTripId = String(tripId ?? itineraryId ?? '').trim()

  const rangeLabel =
    dateRangeLabel?.trim() ||
    (startDate ? formatTripDateRange(startDate, endDate) : '')

  const scrollToDay = (index: number) => {
    const element = document.getElementById(`day-${index}`)
    if (!element) return
    const y = element.getBoundingClientRect().top + window.scrollY - 100
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActiveDayNav(index)
  }

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-[#C5A059]/20 bg-white py-12 text-center text-sm font-medium text-gray-500 shadow-sm">
        {TXT_EMPTY_DAYS}…
      </p>
    )
  }

  if (!resolvedTripId) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50/80 py-12 text-center text-sm font-medium text-amber-900 shadow-sm">
        تعذر تحديد رقم الرحلة لرفع الذكريات. أعد فتح الرابط من بوابة العميل.
      </p>
    )
  }

  return (
    <div
      className="font-[family-name:var(--font-tajawal),system-ui,sans-serif]"
      dir="rtl"
    >
      <LuxuryItineraryHero
        title={tripTitle || destination}
        destination={destination}
        coverImage={coverImage}
        days={days}
        dateRangeLabel={rangeLabel === 'التواريخ قريباً' ? '' : rangeLabel}
        startDate={startDate}
      />

      {heroFooter}

      <nav
        className="sticky top-4 z-40 mb-10 flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white/80 p-2 shadow-sm backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="التنقل بين أيام الرحلة"
      >
        {days.map((day, index) => {
          const isActive = activeDayNav === index
          return (
            <button
              key={`day-nav-${day.index}`}
              type="button"
              onClick={() => scrollToDay(index)}
              className={`whitespace-nowrap rounded-xl border px-5 py-2 text-sm font-bold transition-colors ${
                isActive
                  ? 'border-[#1A3B2A] bg-[#1A3B2A] text-white'
                  : 'border-gray-200 bg-[#F9F9F6] text-gray-700 hover:bg-[#1A3B2A] hover:text-white'
              }`}
            >
              {day.tabLabel?.trim() || `${TXT_DAY_PREFIX} ${index + 1}`}
            </button>
          )
        })}
      </nav>

      <div className="relative mr-4 space-y-12 border-r-2 border-[#C5A059]/20 pr-10 md:mr-8 md:pr-12">
        {days.map((day, index) => (
          <DayBlock
            key={`day-${day.index}`}
            day={day}
            dayIndex={index}
            destination={destination}
            startDate={startDate}
            tripId={resolvedTripId}
            magicLinkId={magicLinkId}
            clientId={clientId}
            memoryUploadingId={memoryUploadingId}
            onUploadStart={setMemoryUploadingId}
            onUploadEnd={() => setMemoryUploadingId(null)}
          />
        ))}
      </div>
    </div>
  )
}
