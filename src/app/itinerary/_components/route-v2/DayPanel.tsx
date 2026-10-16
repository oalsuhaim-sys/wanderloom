'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BedDouble, Car, ChevronDown, Footprints, MapPin, MessageCircle, Sparkles, TrainFront, Users } from 'lucide-react'

import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceSearchUrl,
  buildUberDeepLink,
  buildUberRouteDeepLink,
  isCarTransitActivity,
  type PublicItineraryActivity,
  type PublicItineraryDay,
} from '@/lib/public-itinerary'
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category'
import DayWeatherPill from '../DayWeatherPill'
import { ActivityActionPills } from '../VipDailyItineraryTimeline'
import {
  cityOf,
  dayDateParts,
  dayExpertNotes,
  dayOrdinal,
  formatTime,
  placeName,
  RV,
  type GroundInfo,
} from './route-utils'

type DayPanelProps = {
  day: PublicItineraryDay
  index: number
  startDate: string | null
  destination: string
  color: string
  tripId: string
  magicLinkId?: string | null
  clientId?: string | number | null
  selectedStopId: string | null
  onSelectStop: (id: string | null) => void
  ground: GroundInfo
}

function ModeIcon({ a }: { a: PublicItineraryActivity }) {
  if (a.transitMode === 'walk') return <Footprints className="h-3.5 w-3.5" aria-hidden />
  if (a.transitMode === 'metro') return <TrainFront className="h-3.5 w-3.5" aria-hidden />
  return <Car className="h-3.5 w-3.5" aria-hidden />
}

function Connector({ from, to, hideUber }: { from: PublicItineraryActivity; to: PublicItineraryActivity; hideUber: boolean }) {
  const dur = to.transitDuration?.trim() ?? ''
  const car = isCarTransitActivity(to)
  const directions = buildGoogleMapsDirectionsUrl(placeName(from), placeName(to))
  return (
    <div className="relative flex items-center gap-3 py-2 pr-[19px]">
      <span className="absolute bottom-0 right-[19px] top-0 w-px border-r border-dashed" style={{ borderColor: RV.lineStrong }} aria-hidden />
      <div className="mr-6 flex flex-wrap items-center gap-2 text-[11px] font-bold" style={{ color: RV.muted }}>
        {dur ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: RV.line, background: '#121914' }}>
            <ModeIcon a={to} />
            {dur}
          </span>
        ) : null}
        <a href={directions} target="_blank" rel="noopener noreferrer" className="underline-offset-4 transition hover:underline" style={{ color: RV.muted }}>
          الاتجاهات
        </a>
        {car && !hideUber ? (
          <a
            href={buildUberRouteDeepLink(placeName(from), placeName(to))}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: RV.goldSoft }}
          >
            احجز أوبر للمحطة التالية
          </a>
        ) : null}
      </div>
    </div>
  )
}

function HotelRow({ name, label, mapsQuery }: { name: string; label: string; mapsQuery?: string }) {
  return (
    <a
      href={buildGoogleMapsPlaceSearchUrl(name, mapsQuery)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.99]"
      style={{ borderColor: RV.line, background: 'rgba(212,175,55,0.05)' }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: RV.lineStrong, color: RV.gold }}>
        <BedDouble className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold" style={{ color: RV.goldSoft }}>
          {label}
        </span>
        <span className="block truncate text-sm font-bold" style={{ color: RV.cream }}>
          {name}
        </span>
      </span>
      <MapPin className="h-4 w-4 shrink-0" style={{ color: RV.muted }} aria-hidden />
    </a>
  )
}

function StopRow({
  a,
  order,
  color,
  open,
  onToggle,
  tripId,
  magicLinkId,
  clientId,
  uploadingId,
  setUploadingId,
}: {
  a: PublicItineraryActivity
  order: number
  color: string
  open: boolean
  onToggle: () => void
  tripId: string
  magicLinkId?: string | null
  clientId?: string | number | null
  uploadingId: string | null
  setUploadingId: (id: string | null) => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  const meta = getVipPlaceCategoryMeta(a.category ?? 'o')
  const time = formatTime(a.timeLabel)
  const story = [a.description?.trim(), a.story?.trim()].filter((s, i, arr) => s && s !== a.notes?.trim() && arr.indexOf(s) === i) as string[]

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  return (
    <li ref={ref} className="list-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-right transition-all duration-200 active:scale-[0.99]"
        style={{ borderColor: open ? RV.lineStrong : RV.line, background: open ? RV.cardHi : RV.card }}
      >
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 text-sm font-black tabular-nums"
          style={{ borderColor: color, color: open ? '#141C17' : color, background: open ? color : 'transparent' }}
        >
          {order}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold" style={{ color: RV.cream }}>
            {placeName(a)}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: RV.muted }}>
            <meta.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: RV.goldSoft }} aria-hidden />
            <span className="truncate">{a.categoryLabel ?? meta.label}</span>
            {a.notes?.trim() ? (
              <span className="inline-flex items-center gap-1" style={{ color: RV.gold }}>
                <Sparkles className="h-3 w-3" aria-hidden />
                ملاحظة
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-xs font-black tabular-nums" style={{ color: time ? RV.cream : RV.muted }} dir="ltr">
          {time || 'مرن'}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-300"
          style={{ color: RV.muted, transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-2 mt-2 rounded-2xl border p-3" style={{ borderColor: RV.line, background: '#121914' }}>
              {a.imageUrl?.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl.trim()} alt="" loading="lazy" className="mb-3 h-40 w-full rounded-xl object-cover" />
              ) : null}
              {a.notes?.trim() ? (
                <div className="mb-3 rounded-xl border-r-4 px-3 py-2.5 text-[13px] font-semibold leading-relaxed" style={{ borderColor: RV.gold, background: 'rgba(212,175,55,0.08)', color: RV.cream }}>
                  <span className="ml-1 font-black" style={{ color: RV.gold }}>
                    ملاحظة خبيرتك:
                  </span>
                  {a.notes.trim()}
                </div>
              ) : null}
              {story.map((s, i) => (
                <p key={i} className="mb-2 text-[13px] leading-relaxed" style={{ color: 'rgba(243,235,221,0.75)' }}>
                  {s}
                </p>
              ))}
              {a.locationLabel ? (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold" style={{ color: RV.muted }}>
                  <MapPin className="h-3 w-3" aria-hidden />
                  {a.locationLabel}
                </p>
              ) : null}
              <ActivityActionPills
                activity={a}
                tripId={tripId}
                magicLinkId={magicLinkId}
                clientId={clientId}
                memoryUploadingId={uploadingId}
                onUploadStart={setUploadingId}
                onUploadEnd={() => setUploadingId(null)}
                tone="dark"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

export function GroupArrivalCard({ ground }: { ground: GroundInfo }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: RV.lineStrong, background: 'linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.03))' }}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black" style={{ color: RV.gold }}>
        <Users className="h-4 w-4" aria-hidden />
        الاستقبال عند الوصول
      </div>
      {ground.leaderName ? (
        <p className="text-base font-black" style={{ color: RV.cream }}>
          الليدر: {ground.leaderName}
        </p>
      ) : null}
      {ground.meetingPoint ? (
        <p className="mt-1 text-sm font-semibold" style={{ color: 'rgba(243,235,221,0.8)' }}>
          نقطة اللقاء: {ground.meetingPoint}
        </p>
      ) : null}
      {ground.arrivalNote ? (
        <p className="mt-1 text-[13px]" style={{ color: RV.muted }}>
          {ground.arrivalNote}
        </p>
      ) : null}
      {ground.leaderPhone ? (
        <a
          href={`https://wa.me/${ground.leaderPhone.replace(/^\+/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black"
          style={{ background: RV.gold, color: '#141C17' }}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          راسل الليدر
        </a>
      ) : null}
    </div>
  )
}

export default function DayPanel({
  day,
  index,
  startDate,
  destination,
  color,
  tripId,
  magicLinkId,
  clientId,
  selectedStopId,
  onSelectStop,
  ground,
}: DayPanelProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const parts = dayDateParts(startDate, index)
  const city = cityOf(day, destination)
  const notes = dayExpertNotes(day)
  const hotel = day.hotelName?.trim() || ''
  const first = day.activities[0]
  const last = day.activities[day.activities.length - 1]
  const showArrival = ground.group && index === 0 && Boolean(ground.leaderName || ground.meetingPoint)
  const subtitle = [city, day.title?.trim() && day.title.trim() !== city ? day.title.trim() : ''].filter(Boolean).join(' · ')

  return (
    <motion.section
      key={`panel-${day.index}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
      dir="rtl"
      aria-label={parts?.long ?? `اليوم ${index + 1}`}
    >
      <header className="rounded-[24px] border p-5" style={{ borderColor: RV.line, background: RV.card }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[24px] font-black leading-tight" style={{ color: RV.cream }}>
              {parts?.long ?? dayOrdinal(index)}
            </h3>
            {subtitle ? (
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold" style={{ color: RV.muted }}>
                <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: color }} aria-hidden />
                <span className="truncate">{subtitle}</span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-xl border-2 px-3 py-1.5 text-center" style={{ borderColor: color }}>
            <span className="block text-[10px] font-bold" style={{ color }}>
              اليوم
            </span>
            <span className="block text-[22px] font-black leading-none tabular-nums" style={{ color }}>
              {index + 1}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DayWeatherPill city={day.cityLabel} destination={destination} startDate={startDate} dayIndex={index} variant="dark" />
          <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: RV.line, color: RV.muted }}>
            {day.activities.length} محطات
          </span>
        </div>
      </header>

      {showArrival ? <GroupArrivalCard ground={ground} /> : null}

      {notes.length > 0 ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: RV.lineStrong, background: 'rgba(212,175,55,0.06)' }}>
          <p className="mb-2 flex items-center gap-2 text-xs font-black" style={{ color: RV.gold }}>
            <Sparkles className="h-4 w-4" aria-hidden />
            ملاحظات خبيرتك لهذا اليوم
          </p>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelectStop(n.id)}
                  className="w-full text-right text-[13px] font-semibold leading-relaxed"
                  style={{ color: RV.cream }}
                >
                  <span className="font-black" style={{ color: RV.goldSoft }}>
                    {n.place}:{' '}
                  </span>
                  {n.note}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hotel ? <HotelRow name={hotel} label="نقطة الانطلاق" mapsQuery={day.mapsQuery} /> : null}
      {hotel && first ? (
        <div className="relative py-2 pr-[19px]">
          <span className="absolute bottom-0 right-[19px] top-0 w-px border-r border-dashed" style={{ borderColor: RV.lineStrong }} aria-hidden />
          <div className="mr-6 flex gap-3 text-[11px] font-bold" style={{ color: RV.muted }}>
            <a href={buildGoogleMapsDirectionsUrl(hotel, placeName(first))} target="_blank" rel="noopener noreferrer">
              الاتجاهات للمحطة الأولى
            </a>
            {!ground.privateDriver ? (
              <a href={buildUberDeepLink(placeName(first), { useMyLocationPickup: true })} target="_blank" rel="noopener noreferrer" style={{ color: RV.goldSoft }}>
                احجز أوبر
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {day.activities.length === 0 ? (
        <p className="rounded-2xl border py-10 text-center text-sm font-medium" style={{ borderColor: RV.line, color: RV.muted }}>
          يوم مفتوح لراحتك
        </p>
      ) : (
        <ol className="space-y-0">
          {day.activities.map((a, i) => (
            <div key={a.id}>
              {i > 0 ? <Connector from={day.activities[i - 1]!} to={a} hideUber={ground.privateDriver} /> : null}
              <StopRow
                a={a}
                order={i + 1}
                color={color}
                open={selectedStopId === a.id}
                onToggle={() => onSelectStop(selectedStopId === a.id ? null : a.id)}
                tripId={tripId}
                magicLinkId={magicLinkId}
                clientId={clientId}
                uploadingId={uploadingId}
                setUploadingId={setUploadingId}
              />
            </div>
          ))}
        </ol>
      )}

      {hotel && last ? (
        <div className="relative py-2 pr-[19px]">
          <span className="absolute bottom-0 right-[19px] top-0 w-px border-r border-dashed" style={{ borderColor: RV.lineStrong }} aria-hidden />
          <div className="mr-6 flex gap-3 text-[11px] font-bold" style={{ color: RV.muted }}>
            <a href={buildGoogleMapsDirectionsUrl(placeName(last), hotel)} target="_blank" rel="noopener noreferrer">
              الاتجاهات للفندق
            </a>
            {!ground.privateDriver ? (
              <a href={buildUberDeepLink(hotel, { useMyLocationPickup: true })} target="_blank" rel="noopener noreferrer" style={{ color: RV.goldSoft }}>
                احجز أوبر للعودة
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {hotel ? <HotelRow name={hotel} label="نهاية اليوم · العودة للراحة" /> : null}
    </motion.section>
  )
}
