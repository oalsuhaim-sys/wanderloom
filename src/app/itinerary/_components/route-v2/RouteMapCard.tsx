'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Map as MapIcon, X } from 'lucide-react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import type { VipMapMarker } from '@/lib/vip-map-coordinates'
import type { DaySelection } from './DayStrip'
import { detectCountry, loadCountryGeo, type CountryGeo } from './geo'
import type { StopPoint } from './map-view/use-stop-positions'
import { dayColor } from './map-view/day-colors'
import RealMap from './RealMap'
import StylisedMap from './StylisedMap'
import { cityOf, dayOrdinal, localScriptFor, RV } from './route-utils'
import { useItineraryTheme } from './theme'

// The detailed Mapbox map is only loaded when the client opens it.
const VipMap = dynamic(() => import('../VipMap'), { ssr: false })
const HAS_MAPBOX = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
// The day's real street map (exact positions only) — replaces the drawn map when the day has them.
const DayLeafletMap = dynamic(() => import('./map-view/DayLeafletMap'), { ssr: false })

type RouteMapCardProps = {
  days: PublicItineraryDay[]
  destination: string
  selected: DaySelection
  markersByDay: VipMapMarker[][]
  cityColors: Map<string, string>
  selectedStopId: string | null
  hideUber: boolean
  onSelectDay: (s: DaySelection) => void
  onSelectStop: (id: string | null) => void
  /** Exact positions of every stop (all days) and each day's hotel. */
  exactPoints?: StopPoint[]
  hotels?: Record<number, [number, number]>
}

export default function RouteMapCard({
  days,
  destination,
  selected,
  markersByDay,
  cityColors,
  selectedStopId,
  hideUber,
  onSelectDay,
  onSelectStop,
  exactPoints = [],
  hotels = {},
}: RouteMapCardProps) {
  const theme = useItineraryTheme()
  const [detailOpen, setDetailOpen] = useState(false)
  const isAll = selected === 'all'
  const day = isAll ? null : days[selected]
  const city = day ? cityOf(day, destination) : destination
  const color = cityColors.get(city) ?? RV.gold
  const script = localScriptFor(isAll ? destination : city)
  const totalStops = markersByDay.reduce((s, m) => s + m.length, 0)

  // Real outlines for the destination country (lazy, cached); stylised map until then.
  const countryId = useMemo(() => detectCountry(markersByDay.flat(), destination), [markersByDay, destination])
  const [geoState, setGeoState] = useState<{
    id: string
    geo: CountryGeo | null
  } | null>(null)
  useEffect(() => {
    if (!countryId) return
    let alive = true
    void loadCountryGeo(countryId).then((g) => {
      if (alive) setGeoState({ id: countryId, geo: g })
    })
    return () => {
      alive = false
    }
  }, [countryId])
  const geo = geoState && geoState.id === countryId ? geoState.geo : null
  const dayPoints = useMemo(() => (isAll ? [] : exactPoints.filter((p) => p.dayIndex === selected)), [exactPoints, isAll, selected])
  const streetMap = !isAll && dayPoints.length > 0

  const go = (dir: 1 | -1) => {
    if (isAll) {
      onSelectDay(dir === 1 ? 0 : days.length - 1)
      return
    }
    const next = selected + dir
    if (next < 0 || next >= days.length) onSelectDay('all')
    else onSelectDay(next)
  }

  const mapProps = {
    days,
    destination,
    selected,
    markersByDay,
    cityColors,
    selectedStopId,
    onSelectDay,
    onSelectStop,
  }

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border"
      style={{
        borderColor: RV.line,
        background: 'var(--map-sea)',
        boxShadow: RV.shadow,
      }}
      aria-label="خريطة المسار"
    >
      <motion.div
        drag={streetMap ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x > 70) go(1)
          else if (info.offset.x < -70) go(-1)
        }}
        className="relative aspect-[400/450] touch-pan-y sm:aspect-[16/11] lg:aspect-[400/470]"
        onClick={streetMap ? undefined : () => onSelectStop(null)}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={streetMap ? 'street' : geo ? `geo-${geo.id}` : 'stylised'}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {streetMap ? (
              <DayLeafletMap
                points={dayPoints}
                hotel={hotels[selected as number] ?? null}
                hotelName={day?.hotelName}
                color={dayColor(selected as number)}
                selectedStopId={selectedStopId}
                dark={theme === 'dark'}
                onSelectStop={onSelectStop}
              />
            ) : geo ? (
              <RealMap geo={geo} {...mapProps} />
            ) : (
              <StylisedMap {...mapProps} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between p-5" dir="rtl">
          <AnimatePresence mode="wait">
            <motion.div
              key={isAll ? 'h-all' : `h${selected}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border px-4 py-2.5 backdrop-blur-md"
              style={{ borderColor: RV.line, background: RV.glassStrong }}
            >
              <p className="text-[22px] font-black leading-tight" style={{ color: RV.cream }}>
                {isAll ? 'الرحلة كاملة' : city}
              </p>
              <p className="mt-0.5 text-xs font-bold" style={{ color: isAll ? RV.goldSoft : color }}>
                {isAll
                  ? `${days.length} يوم · ${totalStops} مكان`
                  : `${dayOrdinal(selected as number)} · ${(markersByDay[selected as number] ?? []).length} محطات`}
              </p>
            </motion.div>
          </AnimatePresence>
          {script && !streetMap ? (
            <span
              className="select-none text-[34px] font-black leading-none"
              style={{
                color: RV.cream,
                opacity: 0.85,
                writingMode: 'vertical-rl',
                letterSpacing: 4,
                textShadow: '0 2px 12px var(--map-label-halo)',
              }}
              aria-hidden
            >
              {script}
            </span>
          ) : null}
        </div>
      </motion.div>

      {/* controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-center justify-between p-4 [&>*]:pointer-events-auto" dir="rtl">
        {HAS_MAPBOX && !isAll ? (
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold backdrop-blur-md transition active:scale-95"
            style={{
              borderColor: RV.lineStrong,
              background: RV.glassStrong,
              color: RV.goldText,
            }}
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            الخريطة التفصيلية
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="اليوم السابق"
            className="flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-90"
            style={{
              borderColor: RV.line,
              background: RV.glassStrong,
              color: RV.cream,
            }}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="اليوم التالي"
            className="flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-90"
            style={{
              borderColor: RV.line,
              background: RV.glassStrong,
              color: RV.cream,
            }}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* detailed Mapbox map (existing component) */}
      <AnimatePresence>
        {detailOpen && day ? (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col p-3 backdrop-blur-sm"
            style={{ background: RV.page }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            dir="rtl"
          >
            <div className="mb-3 flex items-center justify-between px-1 pt-[env(safe-area-inset-top)]">
              <p className="text-base font-black" style={{ color: RV.cream }}>
                {dayOrdinal(selected as number)} · {city}
              </p>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                aria-label="إغلاق الخريطة"
                className="flex h-10 w-10 items-center justify-center rounded-full border"
                style={{ borderColor: RV.line, color: RV.cream }}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <VipMap day={day} destination={destination} hideUber={hideUber} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
