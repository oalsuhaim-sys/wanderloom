'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import {
  buildDayMarkersSync,
  refineDayMarkersWithGeocoding,
  type VipMapMarker,
} from '@/lib/vip-map-coordinates'

import VipMapActivitySheet from './VipMapActivitySheet'
import VipMapGoldPin from './VipMapGoldPin'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const MAPBOX_CSS_CDN = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css'
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

const TXT_LOADING = '\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062e\u0631\u064a\u0637\u0629\u2026'
const TXT_EMPTY =
  '\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u0634\u0627\u062a \u0644\u0639\u0631\u0636\u0647\u0627 \u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645.'
const TXT_MAP_FAIL = '\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062e\u0631\u064a\u0637\u0629.'

type VipMapProps = {
  day: PublicItineraryDay
  destination: string
  mapboxAccessToken?: string
}

function fitMapToMarkers(map: MapRef, markers: VipMapMarker[]) {
  if (markers.length === 0) return
  const instance = map.getMap()
  instance.resize()

  if (markers.length === 1) {
    instance.flyTo({
      center: [markers[0]!.lng, markers[0]!.lat],
      zoom: 14,
      duration: 900,
      essential: true,
    })
    return
  }

  const bounds = new mapboxgl.LngLatBounds()
  for (const m of markers) {
    bounds.extend([m.lng, m.lat])
  }
  instance.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 900 })
}

export default function VipMap({ day, destination }: VipMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [markers, setMarkers] = useState<VipMapMarker[]>(() => buildDayMarkersSync(day, destination))
  const [refining, setRefining] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const initial = buildDayMarkersSync(day, destination)
    setMarkers(initial)
    setSelectedId(null)
    setRefining(true)
    setMapError(null)

    let cancelled = false
    void refineDayMarkersWithGeocoding(initial, destination).then((refined) => {
      if (!cancelled) {
        setMarkers(refined)
        setRefining(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [day, destination])

  useEffect(() => {
    if (!mapReady || refining || !mapRef.current || mapError) return
    fitMapToMarkers(mapRef.current, markers)
  }, [markers, refining, mapReady, mapError])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const instance = mapRef.current.getMap()
    const resize = () => instance.resize()
    resize()
    const t1 = window.setTimeout(resize, 100)
    const t2 = window.setTimeout(resize, 500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [mapReady, day.index])

  const routeGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: markers.map((m) => [m.lng, m.lat] as [number, number]),
      },
    }),
    [markers],
  )

  const selected = markers.find((m) => m.activity.id === selectedId) ?? null

  const initialView = useMemo(() => {
    const first = markers[0]
    return {
      longitude: first?.lng ?? -0.1276,
      latitude: first?.lat ?? 51.5072,
      zoom: 11,
    }
  }, [markers])

  if (day.activities.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#002a55]/60 py-16 text-center text-sm font-medium text-white/60">
        {TXT_EMPTY}
      </p>
    )
  }

  if (!MAPBOX_TOKEN) {
    return (
      <p className="rounded-2xl border border-amber-500/40 bg-[#001f3f]/80 py-16 text-center text-sm font-medium text-amber-200/90">
        {'تعذّر تحميل الخريطة — أضف NEXT_PUBLIC_MAPBOX_TOKEN في .env.local'}
      </p>
    )
  }

  return (
    <div className="vip-map-root relative flex h-[60vh] min-h-[500px] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-[#001f3f]/50 shadow-[0_0_24px_rgba(212,175,55,0.12)]">
      <link href={MAPBOX_CSS_CDN} rel="stylesheet" />

      {refining && !mapError ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <span className="rounded-full border border-[#d4af37]/30 bg-[#00152e]/90 px-4 py-1.5 text-[10px] font-bold text-[#d4af37]/90 backdrop-blur-sm">
            {TXT_LOADING}
          </span>
        </div>
      ) : null}

      {mapError ? (
        <div className="z-10 rounded-xl border border-red-500/50 bg-[#001f3f] p-6 text-center text-[#d4af37]">
          <p className="mb-2 text-xl font-bold">{'\u26a0\ufe0f \u062a\u0646\u0628\u064a\u0647 \u0645\u0646 \u0627\u0644\u062e\u0631\u064a\u0637\u0629'}</p>
          <p className="text-sm text-white/70">{mapError}</p>
        </div>
      ) : (
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialView}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          attributionControl
          reuseMaps={false}
          onLoad={(event) => {
            setMapReady(true)
            const map = event.target
            map.resize()
            map.on('error', (e) => {
              console.error('Mapbox Error:', e)
              const msg =
                e.error instanceof Error
                  ? e.error.message
                  : typeof e.error === 'string'
                    ? e.error
                    : TXT_MAP_FAIL
              setMapError(msg)
            })
            window.setTimeout(() => map.resize(), 150)
            window.setTimeout(() => map.resize(), 500)
          }}
          onClick={() => setSelectedId(null)}
        >
          <NavigationControl position="top-left" showCompass={false} />

          {markers.length > 1 ? (
            <Source id="vip-day-route" type="geojson" data={routeGeoJson}>
              <Layer
                id="vip-day-route-line"
                type="line"
                paint={{
                  'line-color': '#d4af37',
                  'line-width': 3,
                  'line-opacity': 0.7,
                  'line-dasharray': [2, 2],
                }}
              />
            </Source>
          ) : null}

          {markers.map((marker) => (
            <Marker
              key={marker.activity.id}
              longitude={marker.lng}
              latitude={marker.lat}
              anchor="center"
              onClick={(event) => {
                event.originalEvent.stopPropagation()
                setSelectedId(marker.activity.id)
              }}
            >
              <VipMapGoldPin
                order={marker.order}
                pulse={marker.order === 1}
                selected={selectedId === marker.activity.id}
              />
            </Marker>
          ))}
        </Map>
      )}

      {selected && !mapError ? (
        <VipMapActivitySheet
          activity={selected.activity}
          order={selected.order}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  )
}
