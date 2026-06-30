import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'

export type VipMapMarker = {
  activity: PublicItineraryActivity
  lat: number
  lng: number
  order: number
}

const NOMINATIM_CACHE = new Map<string, [number, number]>()

/** مراكز مدن شائعة — fallback عند غياب الإحداثيات */
const CITY_CENTERS: Record<string, [number, number]> = {
  paris: [48.8566, 2.3522],
  '\u0628\u0627\u0631\u064a\u0633': [48.8566, 2.3522],
  london: [51.5074, -0.1278],
  '\u0644\u0646\u062f\u0646': [51.5074, -0.1278],
  dubai: [25.2048, 55.2708],
  '\u062f\u0628\u064a': [25.2048, 55.2708],
  tokyo: [35.6762, 139.6503],
  '\u0637\u0648\u0643\u064a\u0648': [35.6762, 139.6503],
  rome: [41.9028, 12.4964],
  '\u0631\u0648\u0645\u0627': [41.9028, 12.4964],
  milan: [45.4642, 9.19],
  '\u0645\u064a\u0644\u0627\u0646\u0648': [45.4642, 9.19],
  edinburgh: [55.9533, -3.1883],
  '\u0625\u062f\u0646\u0628\u0631\u0629': [55.9533, -3.1883],
  seoul: [37.5665, 126.978],
  '\u0633\u064a\u0648\u0644': [37.5665, 126.978],
  riyadh: [24.7136, 46.6753],
  '\u0627\u0644\u0631\u064a\u0627\u0636': [24.7136, 46.6753],
  jeddah: [21.4858, 39.1925],
  '\u062c\u062f\u0629': [21.4858, 39.1925],
  cairo: [30.0444, 31.2357],
  '\u0627\u0644\u0642\u0627\u0647\u0631\u0629': [30.0444, 31.2357],
  istanbul: [41.0082, 28.9784],
  '\u0625\u0633\u0637\u0646\u0628\u0648\u0644': [41.0082, 28.9784],
}

function normalizeCityKey(value: string): string {
  return value.trim().toLowerCase()
}

export function resolveCityCenter(cityLabel: string, destination: string): [number, number] {
  for (const candidate of [cityLabel, destination]) {
    const key = normalizeCityKey(candidate)
    if (CITY_CENTERS[key]) return CITY_CENTERS[key]!
    for (const [name, coords] of Object.entries(CITY_CENTERS)) {
      if (key.includes(name) || name.includes(key)) return coords
    }
  }
  return [25.2048, 55.2708]
}

function offsetAroundCenter(center: [number, number], index: number, total: number): [number, number] {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2
  const spread = 0.0042 + index * 0.0014
  return [center[0] + Math.sin(angle) * spread, center[1] + Math.cos(angle) * spread]
}

export async function geocodeMapsQuery(query: string): Promise<[number, number] | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (NOMINATIM_CACHE.has(key)) return NOMINATIM_CACHE.get(key)!

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'ar,en',
        },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: string; lon?: string }[]
    const hit = data[0]
    if (!hit?.lat || !hit.lon) return null
    const coords: [number, number] = [parseFloat(hit.lat), parseFloat(hit.lon)]
    if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null
    NOMINATIM_CACHE.set(key, coords)
    return coords
  } catch {
    return null
  }
}

export function buildDayMarkersSync(day: PublicItineraryDay, destination: string): VipMapMarker[] {
  const center = resolveCityCenter(day.cityLabel || day.mapsQuery, destination)
  const total = day.activities.length

  return day.activities.map((activity, index) => {
    if (activity.lat != null && activity.lng != null) {
      return { activity, lat: activity.lat, lng: activity.lng, order: index + 1 }
    }
    const [lat, lng] = offsetAroundCenter(center, index, total)
    return { activity, lat, lng, order: index + 1 }
  })
}

export async function refineDayMarkersWithGeocoding(
  markers: VipMapMarker[],
  destination: string,
): Promise<VipMapMarker[]> {
  const refined: VipMapMarker[] = []

  for (const marker of markers) {
    if (marker.activity.lat != null && marker.activity.lng != null) {
      refined.push(marker)
      continue
    }

    const query = [marker.activity.mapsQuery, destination].filter(Boolean).join(', ')
    const geocoded = await geocodeMapsQuery(query)
    if (geocoded) {
      refined.push({ ...marker, lat: geocoded[0], lng: geocoded[1] })
    } else {
      refined.push(marker)
    }
  }

  return refined
}
