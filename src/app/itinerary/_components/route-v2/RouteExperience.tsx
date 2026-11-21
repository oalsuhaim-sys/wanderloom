'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { List, Map as MapIcon } from 'lucide-react'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import { buildDayMarkersSync, refineDayMarkersWithGeocoding, type VipMapMarker } from '@/lib/vip-map-coordinates'
import DayPanel from './DayPanel'
import DayStrip, { type DaySelection } from './DayStrip'
import FullMapView from './map-view/FullMapView'
import RouteMapCard from './RouteMapCard'
import TripOverviewList from './TripOverviewList'
import { buildCityColors, cityOf, readGroundInfo, RV, todayIndex } from './route-utils'

type RouteView = 'list' | 'map'

/** «قائمة | خريطة» — same look as the theme switch. */
function ViewToggle({ view, onChange }: { view: RouteView; onChange: (v: RouteView) => void }) {
  const item = (value: RouteView, label: string, Icon: typeof List) => {
    const active = view === value
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={active}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all duration-200 active:scale-95"
        style={{ background: active ? RV.gold : 'transparent', color: active ? RV.onGold : RV.text2 }}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label="طريقة عرض المسار"
      className="inline-flex items-center gap-0.5 rounded-full border p-1"
      style={{ borderColor: RV.lineStrong, background: RV.glassStrong }}
    >
      {item('list', 'قائمة', List)}
      {item('map', 'خريطة', MapIcon)}
    </div>
  )
}

function readViewParam(): RouteView {
  try {
    return new URLSearchParams(window.location.search).get('view') === 'map' ? 'map' : 'list'
  } catch {
    return 'list'
  }
}

function writeViewParam(view: RouteView) {
  try {
    const url = new URL(window.location.href)
    if (view === 'map') url.searchParams.set('view', 'map')
    else url.searchParams.delete('view')
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* ignore */
  }
}

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
 * Interactive route: sticky day strip → real map of the day (flies between days) → the day itself.
 * Opens on today's day while the trip is running, otherwise on day one.
 */
export default function RouteExperience({ days, destination, startDate, flightDetails, tripId, magicLinkId = null, clientId }: RouteExperienceProps) {
  const today = useMemo(() => todayIndex(startDate, days.length), [startDate, days.length])
  const [selected, setSelected] = useState<DaySelection>(() => today ?? 0)
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [view, setView] = useState<RouteView>('list')
  // a shared link with ?view=map opens on the map
  useEffect(() => {
    const fromUrl = readViewParam()
    if (fromUrl === 'map') queueMicrotask(() => setView('map'))
  }, [])
  const changeView = (v: RouteView) => {
    setView(v)
    writeViewParam(v)
  }
  const ground = useMemo(() => readGroundInfo(flightDetails), [flightDetails])
  const cityColors = useMemo(() => buildCityColors(days, destination), [days, destination])
  const topRef = useRef<HTMLDivElement>(null)

  // Positions: instant approximations first, refined (geocoded) per visited day.
  const baseMarkers = useMemo(() => days.map((d) => buildDayMarkersSync(d, destination)), [days, destination])
  const signature = useMemo(() => `${destination}|${days.map((d) => d.activities.map((a) => a.id).join(',')).join('/')}`, [days, destination])
  const [refinedState, setRefinedState] = useState<{
    sig: string
    byDay: Record<number, VipMapMarker[]>
  }>({ sig: '', byDay: {} })
  const requested = useRef<Set<string>>(new Set())
  const markersByDay = useMemo(
    () => baseMarkers.map((m, i) => (refinedState.sig === signature ? (refinedState.byDay[i] ?? m) : m)),
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
      setRefinedState((prev) => ({
        sig: signature,
        byDay: { ...(prev.sig === signature ? prev.byDay : {}), [i]: r },
      }))
    })
    return () => {
      cancelled = true
      asked.delete(key)
    }
  }, [selected, baseMarkers, destination, signature])

  const select = (s: DaySelection) => {
    setSelected(s)
    setSelectedStopId(null)
    // bring the map back into view when the client picked a day far down the page
    const el = topRef.current
    if (!el) return
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wl-tabnav-h')) || 0
    const top = el.getBoundingClientRect().top
    if (top < navH - 40) window.scrollTo({ top: window.scrollY + top - navH, behavior: 'smooth' })
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

  const openDayInList = (i: number) => {
    changeView('list')
    select(i)
  }

  if (view === 'map') {
    return (
      <div ref={topRef} className="scroll-mt-0 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
        <div className="mb-4 flex justify-center">
          <ViewToggle view={view} onChange={changeView} />
        </div>
        <FullMapView days={days} destination={destination} startDate={startDate} initial="all" onOpenDay={openDayInList} />
      </div>
    )
  }

  return (
    <div ref={topRef} className="scroll-mt-0 font-[family-name:var(--font-tajawal),system-ui,sans-serif]" dir="rtl">
      <div className="mb-4 flex justify-center">
        <ViewToggle view={view} onChange={changeView} />
      </div>
      <DayStrip days={days} startDate={startDate} destination={destination} selected={selected} today={today} cityColors={cityColors} onSelect={select} />

      <div className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        <div className="lg:sticky lg:top-[calc(var(--wl-tabnav-h,0px)+104px)]">
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
        </div>

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
          <TripOverviewList days={days} startDate={startDate} destination={destination} today={today} cityColors={cityColors} onSelectDay={select} />
        )}
      </div>
    </div>
  )
}
