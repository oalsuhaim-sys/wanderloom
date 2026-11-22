'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './full-map.css'

import type { StopPoint } from './use-stop-positions'

/**
 * The day's real map inside the route card (list view): soft street map, the hotel as start, the
 * stops numbered in order with a dashed route. Tapping a pin opens that stop in the list; the stop
 * opened in the list is highlighted here.
 */

type Props = {
  points: StopPoint[]
  hotel: [number, number] | null
  hotelName?: string
  color: string
  selectedStopId: string | null
  dark: boolean
  onSelectStop: (id: string | null) => void
}

function stopIcon(color: string, n: number, active: boolean) {
  const w = active ? 40 : 30
  const h = Math.round(w * 1.3)
  return L.divIcon({
    className: 'wl-fullmap-pin',
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 39" aria-hidden="true">
      <path d="M15 38.2C15 38.2 27.5 24.6 27.5 14.6A12.5 12.5 0 0 0 2.5 14.6C2.5 24.6 15 38.2 15 38.2Z" fill="${color}" stroke="#fff" stroke-width="2.2"/>
      <text x="15" y="19" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${n}</text>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 1],
  })
}

const HOTEL_ICON = L.divIcon({
  className: 'wl-fullmap-pin',
  html: `<div style="width:34px;height:34px;border-radius:12px;background:#1d1a14;border:2px solid #C49A2C;display:flex;align-items:center;justify-content:center">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6C46B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

/** Frame the day; leave room for the card's header (top) and buttons (bottom). */
function Frame({ pts, dayKey }: { pts: Array<[number, number]>; dayKey: string }) {
  const map = useMap()
  const last = useRef('')
  useEffect(() => {
    if (!pts.length || last.current === dayKey) return
    last.current = dayKey
    const opts = { paddingTopLeft: [36, 120] as [number, number], paddingBottomRight: [36, 86] as [number, number], maxZoom: 16 }
    if (pts.length === 1) map.setView(pts[0]!, 15)
    else map.flyToBounds(L.latLngBounds(pts), { ...opts, duration: 0.7 })
  }, [map, pts, dayKey])
  return null
}

function FocusStop({ point }: { point: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.panTo(point, { animate: true })
  }, [map, point])
  return null
}

export default function DayLeafletMap({ points, hotel, hotelName, color, selectedStopId, dark, onSelectStop }: Props) {
  const ordered = useMemo(() => [...points].sort((a, b) => a.order - b.order), [points])
  const route = useMemo(() => [...(hotel ? [hotel] : []), ...ordered.map((p) => [p.lat, p.lng] as [number, number])], [hotel, ordered])
  const dayKey = useMemo(() => ordered.map((p) => p.activity.id).join(',') + (hotel ? `|${hotel.join(',')}` : ''), [ordered, hotel])
  const selected = ordered.find((p) => p.activity.id === selectedStopId)
  const center: [number, number] = route[0] ?? [37.5665, 126.978]

  return (
    <div dir="ltr" className={`wl-fullmap h-full w-full ${dark ? 'wl-fullmap--dark' : ''}`}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} zoomControl={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Frame pts={route} dayKey={dayKey} />
        <FocusStop point={selected ? [selected.lat, selected.lng] : null} />
        {route.length > 1 ? <Polyline positions={route} pathOptions={{ color, weight: 3, opacity: 0.8, dashArray: '6 8' }} /> : null}
        {hotel ? <Marker position={hotel} icon={HOTEL_ICON} title={hotelName || 'الفندق'} zIndexOffset={-100} /> : null}
        {ordered.map((p) => {
          const active = p.activity.id === selectedStopId
          return (
            <Marker
              key={p.activity.id}
              position={[p.lat, p.lng]}
              icon={stopIcon(color, p.order, active)}
              zIndexOffset={active ? 1000 : 0}
              eventHandlers={{ click: () => onSelectStop(active ? null : p.activity.id) }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
