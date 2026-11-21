import { canonicalTripCountryId, englishPlaceName } from '@/lib/destination-match'
import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'
import { placeName } from '../route-utils'

/**
 * «Open the day in Google Maps» — official Google Maps URLs (no key, no cost). Google places each
 * stop itself from its name (or its exact position when we have one) and draws the route in order.
 * Google allows 3 waypoints on phones and 9 elsewhere, so long days are split into several links
 * that continue from where the previous one ended.
 */

const parts = (label: string | null | undefined) =>
  String(label ?? '')
    .split(/[·,،|/]/)
    .map((s) => s.trim())
    .filter(Boolean)

const COUNTRY_EN: Record<string, string> = { korea: 'South Korea', uk: 'United Kingdom', usa: 'USA', uae: 'UAE' }

/** English place / country name Google understands (falls back to the label itself). */
function inEnglish(label: string): string {
  const en = englishPlaceName(label)
  if (en) return en
  const id = canonicalTripCountryId(label)
  return id ? (COUNTRY_EN[id] ?? id.charAt(0).toUpperCase() + id.slice(1)) : label
}

/** «Lotte World, Seoul» — the stop's own city when it is clear, otherwise the country. */
function stopQuery(day: PublicItineraryDay, a: PublicItineraryActivity, destination: string): string {
  const name = placeName(a)
  const dayCities = parts(day.cityLabel)
  const own = parts(a.locationLabel)
  const city = own.length && !(dayCities.length > 1 && own.join('·') === dayCities.join('·')) ? own[0] : dayCities.length === 1 ? dayCities[0] : ''
  const where = inEnglish(city || destination)
  return where && !name.toLowerCase().includes(where.toLowerCase()) ? `${name}, ${where}` : name
}

export function googleDayRouteLinks(
  day: PublicItineraryDay,
  destination: string,
  exact: Map<string, [number, number]>,
  maxPoints: number,
): string[] {
  const points: string[] = []
  const hotel = day.hotelName?.trim()
  if (hotel) points.push(hotel)
  for (const a of day.activities) {
    const c = exact.get(a.id)
    points.push(c ? `${c[0]},${c[1]}` : stopQuery(day, a, destination))
  }
  if (points.length < 2) {
    return points.length ? [`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(points[0]!)}`] : []
  }
  const links: string[] = []
  for (let start = 0; start < points.length - 1; start += maxPoints - 1) {
    const chunk = points.slice(start, start + maxPoints)
    if (chunk.length < 2) break
    const params = new URLSearchParams({ api: '1', origin: chunk[0]!, destination: chunk[chunk.length - 1]! })
    const waypoints = chunk.slice(1, -1)
    if (waypoints.length) params.set('waypoints', waypoints.join('|'))
    links.push(`https://www.google.com/maps/dir/?${params.toString()}`)
  }
  return links
}
