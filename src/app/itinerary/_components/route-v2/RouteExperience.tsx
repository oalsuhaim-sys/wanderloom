'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import { buildDayMarkersSync, refineDayMarkersWithGeocoding, type VipMapMarker } from '@/lib/vip-map-coordinates'
import DayPanel from './DayPanel'
import DayStrip, { type DaySelection } from './DayStrip'
import RouteMapCard from './RouteMapCard'
import TripOverviewList from './TripOverviewList'
import { buildCityColors, cityOf, readGroundInfo, RV, todayIndex } from './route-utils'

type RouteExperienceProps = {
  days: PublicItineraryDay[]
  destination: string
  startDate: string | null
  flightDetails: Record<string, unknown> | null
  tripId: string | number
  magicLinkId?: string | null
  clientId?: string | number | null
}

/**
 * Interactive route: sticky day strip → stylised route map → the day itself.
 * Opens on today's day while the trip is running, otherwise on day one.
 */
export default function RouteExperience({
  days,
  destination,
  startDate,
  flightDetails,
  tripId,
  magicLinkId = null,
  clientId,
}: RouteExperienceProps) {
  const today = useMemo(() => todayIndex(startDate, days.length), [startDate, days.length])
  const [selected, setSelected] = useState<DaySelection>(() => today ?? 0)
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const ground = useMemo(() => readGroundInfo(flightDetails), [flightDetails])
  const cityColors = useMemo(() => buildCityColors(days, destination), [days, destination])
  const topRef = useRef<HTMLDivElement>(null)

  // Positions: instant approximations first, refined (geocoded) per visited day.
  const baseMarkers = useMemo(() => days.map((d) => buildDayMarkersSync(d, destination)), [days, destination])
  const signature = useMemo(() => `${destination}|${days.map((d) => d.activities.map((a) => a.id).join(',')).join('/')}`, [days, destination])
  const [refinedState, setRefinedState] = useState<{ sig: string; byDay: Record<number, VipMapMarker[]> }>({ sig: '', byDay: {} })
  const requested = useRef<Set<string>>(new Set())
  const markersByDay = useMemo(
    () => baseMarkers.map((m, i) => (refinedState.sig === signature ? refinedState.byDay[i] ?? m : m)),
    [baseMarkers, refinedState, signature],
  )

  useEffect(() => {
    if (selected === 'all') return
    const i = selected
    const key = `${signature}#${i}`
    const asked = requested.current
    if (asked.has(key) || !baseMarkers[i]) return
    asked.add(key)
    let cancelled = false
    void refineDayMarkersWithGeocoding(baseMarkers[i]!, destination).then((r) => {
      if (cancelled) return
      setRefinedState((prev) => ({ sig: signature, byDay: { ...(prev.sig === signature ? prev.byDay : {}), [i]: r } }))
    })
    return () => {
      cancelled = true
      asked.delete(key)
    }
  }, [selected, baseMarkers, destination, signature])

  const select = (s: DaySelection) => {
    setSelected(s)
    setSelectedStopId(null)
    const top = topRef.current?.getBoundingClientRect().top ?? 0
    if (top < -40) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border py-12 text-center text-sm font-medium" style={{ borderColor: RV.line, color: RV.muted }}>
        جاري تنسيق تفاصيل أيام رحلتك…
      </p>
    )
  }

  const resolvedTripId = String(tripId ?? '').trim()
  const day = selected === 'all' ? null : days[selected]!

  return (
    <div ref={topRef} className="scroll-mt-0 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
      <DayStrip
        days={days}
        startDate={startDate}
        destination={destination}
        selected={selected}
        today={today}
        cityColors={cityColors}
        onSelect={select}
      />

      <div className="mt-4 space-y-4">
        <RouteMapCard
          days={days}
          destination={destination}
          selected={selected}
          markersByDay={markersByDay}
          cityColors={cityColors}
          selectedStopId={selectedStopId}
          hideUber={ground.privateDriver}
          onSelectDay={select}
          onSelectStop={setSelectedStopId}
        />

        {day ? (
          <DayPanel
            key={`day-${selected}`}
            day={day}
            index={selected as number}
            startDate={startDate}
            destination={destination}
            color={cityColors.get(cityOf(day, destination)) ?? RV.gold}
            tripId={resolvedTripId}
            magicLinkId={magicLinkId}
            clientId={clientId}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
            ground={ground}
          />
        ) : (
          <TripOverviewList
            days={days}
            startDate={startDate}
            destination={destination}
            today={today}
            cityColors={cityColors}
            onSelectDay={select}
          />
        )}
      </div>
    </div>
  )
}
