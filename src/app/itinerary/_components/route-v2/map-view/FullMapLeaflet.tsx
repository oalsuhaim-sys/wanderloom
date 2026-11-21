'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './full-map.css'

import { buildGoogleMapsPlaceSearchUrl } from '@/lib/public-itinerary'
import { getVipPlaceCategoryMeta } from '@/lib/vip-place-category'
import type { DaySelection } from '../DayStrip'
import { dayDateParts, formatTime, placeName } from '../route-utils'
import { dayColor } from './day-colors'
import type { StopPoint } from './use-stop-positions'

type Props = {
  startDate: string | null
  points: StopPoint[]
  filter: DaySelection
  /** Changes when the view should re-frame (filter changed / positions finished loading). */
  frameKey: string
  dark: boolean
  onOpenDay: (dayIndex: number) => void
}

const FALLBACK_CENTER: [number, number] = [37.5665, 126.978]

function pinIcon(color: string, label: string | number, active: boolean) {
  const w = active ? 38 : 30
  const h = Math.round(w * 1.3)
  return L.divIcon({
    className: 'wl-fullmap-pin',
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 39" aria-hidden="true">
      <path d="M15 38.2C15 38.2 27.5 24.6 27.5 14.6A12.5 12.5 0 0 0 2.5 14.6C2.5 24.6 15 38.2 15 38.2Z" fill="${color}" stroke="#fff" stroke-width="2.2"/>
      <text x="15" y="19" text-anchor="middle" font-size="${String(label).length > 1 ? 10.5 : 12}" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${label}</text>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 1],
    popupAnchor: [0, -h + 6],
  })
}

/** Stops at the same spot (e.g. the same place on two days) are fanned out slightly so each pin shows. */
function spreadOverlaps(points: StopPoint[]): StopPoint[] {
  const seen = new Map<string, number>()
  return points.map((p) => {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    if (n === 0) return p
    const angle = (n * 2 * Math.PI) / 6
    const r = 0.00018 * Math.ceil(n / 6)
    return { ...p, lat: p.lat + Math.sin(angle) * r, lng: p.lng + Math.cos(angle) * r }
  })
}

/** Re-frame the map on the visible stops when the filter changes or positions finish loading. */
function FrameOnPoints({ points, frameKey }: { points: StopPoint[]; frameKey: string }) {
  const map = useMap()
  const last = useRef('')
  useEffect(() => {
    if (!points.length || last.current === frameKey) return
    last.current = frameKey
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    if (points.length === 1) map.flyTo(bounds.getCenter(), 15, { duration: 0.8 })
    else map.flyToBounds(bounds.pad(0.12), { duration: 0.8, maxZoom: 15 })
  }, [map, points, frameKey])
  return null
}

export default function FullMapLeaflet({ startDate, points, filter, frameKey, dark, onOpenDay }: Props) {
  const visible = useMemo(() => spreadOverlaps(filter === 'all' ? points : points.filter((p) => p.dayIndex === filter)), [points, filter])
  const route = useMemo(
    () => (filter === 'all' ? [] : [...visible].sort((a, b) => a.order - b.order).map((p) => [p.lat, p.lng] as [number, number])),
    [visible, filter],
  )
  const center: [number, number] = visible[0] ? [visible[0].lat, visible[0].lng] : FALLBACK_CENTER

  return (
    <div dir="ltr" className={`wl-fullmap h-full w-full ${dark ? 'wl-fullmap--dark' : ''}`}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FrameOnPoints points={visible} frameKey={frameKey} />
        {route.length > 1 ? (
          <Polyline positions={route} pathOptions={{ color: dayColor(filter as number), weight: 3, opacity: 0.75, dashArray: '6 8' }} />
        ) : null}
        {visible.map((p) => {
          const color = dayColor(p.dayIndex)
          const parts = dayDateParts(startDate, p.dayIndex)
          const meta = getVipPlaceCategoryMeta(p.activity.category ?? 'o')
          const time = formatTime(p.activity.timeLabel)
          const name = placeName(p.activity)
          return (
            <Marker
              key={`${p.dayIndex}-${p.activity.id}`}
              position={[p.lat, p.lng]}
              icon={pinIcon(color, filter === 'all' ? p.dayIndex + 1 : p.order, false)}
              title={name}
            >
              <Popup closeButton={false} className="wl-fullmap-popup" maxWidth={260} minWidth={220}>
                <div dir="rtl" className="wl-pop">
                  <span className="wl-pop-day" style={{ background: color }}>
                    اليوم {p.dayIndex + 1}
                    {parts ? ` · ${parts.long}` : ''}
                  </span>
                  <strong className="wl-pop-name">{name}</strong>
                  <span className="wl-pop-meta">
                    {meta.label}
                    {time ? ` · ${time}` : ''}
                    {` · المحطة ${p.order}`}
                  </span>
                  <span className="wl-pop-actions">
                    <button type="button" onClick={() => onOpenDay(p.dayIndex)} style={{ color }}>
                      تفاصيل اليوم
                    </button>
                    <a href={buildGoogleMapsPlaceSearchUrl(p.activity.mapsQuery || name)} target="_blank" rel="noopener noreferrer">
                      خرائط Google
                    </a>
                  </span>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
