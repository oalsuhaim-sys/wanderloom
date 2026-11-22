'use client'

import { useEffect, useMemo, useState } from 'react'

import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'
import { placeName } from '../route-utils'

/**
 * Exact positions for every stop of the trip, for the map view — certain positions only:
 * 1. the stop's own coordinates, 2. the places bank (server): the row's lat / lng or the position
 * in its map link. Nothing is guessed from the place name: a wrong pin is worse than no pin.
 */

export type StopPoint = {
  dayIndex: number
  order: number
  activity: PublicItineraryActivity
  lat: number
  lng: number
}

type Job = { key: string; dayIndex: number; order: number; activity: PublicItineraryActivity; name: string; city: string }

export function useStopPositions(
  days: PublicItineraryDay[],
  destination: string,
): { points: StopPoint[]; total: number; pending: number; hotels: Record<number, [number, number]> } {
  const jobs = useMemo<Job[]>(
    () =>
      days.flatMap((day, dayIndex) =>
        day.activities.map((activity, i) => ({
          key: `${dayIndex}:${activity.id}`,
          dayIndex,
          order: i + 1,
          activity,
          name: placeName(activity),
          city: activity.locationLabel?.trim() || day.cityLabel || destination,
        })),
      ),
    [days, destination],
  )

  // each day's hotel (start / end of the day on the map), matched in the bank by name
  const hotelItems = useMemo(
    () =>
      days
        .map((d, i) => ({ key: `hotel:${i}`, name: d.hotelName?.trim() ?? '', city: d.cityLabel || destination }))
        .filter((h) => h.name),
    [days, destination],
  )
  const [found, setFound] = useState<Record<string, [number, number]>>({})
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let cancelled = false
    const need = jobs.filter((j) => j.activity.lat == null || j.activity.lng == null)
    if (!need.length && !hotelItems.length) return
    queueMicrotask(() => !cancelled && setPending(need.length))
    void (async () => {
      const out: Record<string, [number, number]> = {}
      try {
        const res = await fetch('/api/itinerary-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              ...need.map((j) => ({ key: j.key, bankId: j.activity.placesBankId ?? null, name: j.name, city: j.city })),
              ...hotelItems,
            ],
          }),
        })
        const json = (await res.json().catch(() => null)) as { positions?: Record<string, [number, number]> } | null
        for (const [k, v] of Object.entries(json?.positions ?? {})) {
          if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) out[k] = [v[0], v[1]]
        }
      } catch {
        /* no positions — the map says how many stops have none yet */
      }
      if (cancelled) return
      setFound(out)
      setPending(0)
    })()
    return () => {
      cancelled = true
    }
  }, [jobs, hotelItems])

  return useMemo(() => {
    const points: StopPoint[] = []
    for (const j of jobs) {
      const own = j.activity.lat != null && j.activity.lng != null ? ([j.activity.lat, j.activity.lng] as [number, number]) : null
      const c = own ?? found[j.key] ?? null
      if (c) points.push({ dayIndex: j.dayIndex, order: j.order, activity: j.activity, lat: c[0], lng: c[1] })
    }
    const hotels: Record<number, [number, number]> = {}
    for (const [k, v] of Object.entries(found)) if (k.startsWith('hotel:')) hotels[Number(k.slice(6))] = v
    return { points, total: jobs.length, pending, hotels }
  }, [jobs, found, pending])
}
