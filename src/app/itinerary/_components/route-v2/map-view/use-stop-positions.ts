'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'
import { resolveCityCenter } from '@/lib/vip-map-coordinates'
import { cityOf, placeName } from '../route-utils'

/**
 * Exact positions for every stop of the trip, for the map view.
 * - Stops that already carry coordinates are used as-is.
 * - The rest are looked up on OpenStreetMap (Nominatim, one request per second — their fair-use
 *   rule), the chosen day first, and remembered on this device so later visits are instant.
 * - Results far from the day's city are dropped: a wrong pin is worse than no pin.
 * Approximate «around the city centre» positions are never shown on the real map.
 */

export type StopPoint = {
  dayIndex: number
  order: number
  activity: PublicItineraryActivity
  lat: number
  lng: number
}

type Coords = [number, number] | null
const STORE_KEY = 'wl-geo-v1'
const MAX_KM = 400

function readStore(): Record<string, Coords> {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Coords>) : {}
  } catch {
    return {}
  }
}

function writeStore(cache: Record<string, Coords>) {
  try {
    const keys = Object.keys(cache)
    // keep the store small
    const trimmed = keys.length > 1500 ? Object.fromEntries(keys.slice(-1200).map((k) => [k, cache[k]!])) : cache
    window.localStorage.setItem(STORE_KEY, JSON.stringify(trimmed))
  } catch {
    /* storage may be blocked — positions are then looked up again next time */
  }
}

function km(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function queryFor(day: PublicItineraryDay, a: PublicItineraryActivity, destination: string): string {
  const base = a.mapsQuery?.trim() || placeName(a)
  const city = cityOf(day, destination)
  return [base, base.includes(city) ? '' : city].filter(Boolean).join(', ')
}

async function nominatim(query: string): Promise<Coords> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json', 'Accept-Language': 'en,ar' },
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const lat = Number(data[0]?.lat)
    const lng = Number(data[0]?.lon)
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  } catch {
    throw new Error('lookup failed') // network problem: not cached, tried again next visit
  }
}

export function useStopPositions(
  days: PublicItineraryDay[],
  destination: string,
  priorityDay: number | 'all',
): { points: StopPoint[]; total: number; missing: number; pending: number } {
  const jobs = useMemo(
    () =>
      days.flatMap((day, dayIndex) =>
        day.activities.map((activity, i) => {
          const centers = [resolveCityCenter(day.cityLabel || day.mapsQuery, destination), resolveCityCenter(destination, destination)]
          return { dayIndex, order: i + 1, activity, query: queryFor(day, activity, destination), centers }
        }),
      ),
    [days, destination],
  )

  const [found, setFound] = useState<Record<string, Coords>>({})
  const [pending, setPending] = useState(0)
  const priorityRef = useRef(priorityDay)
  useEffect(() => {
    priorityRef.current = priorityDay
  }, [priorityDay])

  useEffect(() => {
    let cancelled = false
    const cache = readStore()
    const known: Record<string, Coords> = {}
    const todo: string[] = []
    for (const j of jobs) {
      if (j.activity.lat != null && j.activity.lng != null) continue
      if (j.query in cache) known[j.query] = cache[j.query]!
      else if (!todo.includes(j.query)) todo.push(j.query)
    }
    queueMicrotask(() => {
      if (cancelled) return
      setFound(known)
      setPending(todo.length)
    })
    if (!todo.length) return () => {
      cancelled = true
    }

    const run = async () => {
      const left = [...todo]
      while (left.length && !cancelled) {
        // the day the client is looking at goes first
        const p = priorityRef.current
        const idx = p === 'all' ? 0 : Math.max(0, left.findIndex((q) => jobs.some((j) => j.dayIndex === p && j.query === q)))
        const q = left.splice(idx, 1)[0]!
        try {
          const coords = await nominatim(q)
          const job = jobs.find((j) => j.query === q)
          const near = coords && job ? job.centers.some((c) => km(c, coords) <= MAX_KM) : false
          const value: Coords = near ? coords : null
          cache[q] = value
          writeStore(cache)
          if (!cancelled) setFound((prev) => ({ ...prev, [q]: value }))
        } catch {
          /* leave it for next visit */
        }
        if (!cancelled) setPending(left.length)
        await new Promise((r) => setTimeout(r, 1100))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [jobs])

  return useMemo(() => {
    const points: StopPoint[] = []
    for (const j of jobs) {
      const own = j.activity.lat != null && j.activity.lng != null ? ([j.activity.lat, j.activity.lng] as [number, number]) : null
      const c = own ?? found[j.query] ?? null
      if (c) points.push({ dayIndex: j.dayIndex, order: j.order, activity: j.activity, lat: c[0], lng: c[1] })
    }
    return { points, total: jobs.length, missing: Math.max(0, jobs.length - points.length - pending), pending }
  }, [jobs, found, pending])
}
