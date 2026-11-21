'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'
import { resolveCityCenter } from '@/lib/vip-map-coordinates'
import { placeName } from '../route-utils'

/**
 * Exact positions for every stop of the trip, for the map view.
 * 1. The stop's own coordinates.
 * 2. The places bank (server): the row's lat / lng or the position in its map link.
 * 3. Otherwise OpenStreetMap search by place name, limited to a box around the stop's city (one
 *    request per second — their fair-use rule), the chosen day first, remembered on this device.
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
const STORE_KEY = 'wl-geo-v2'
/** Half-size of the search box around a city, in degrees (~55 km). */
const BOX = 0.5

type Job = {
  key: string
  dayIndex: number
  order: number
  activity: PublicItineraryActivity
  name: string
  city: string
  centers: Array<[number, number]>
}

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
    const trimmed = keys.length > 1500 ? Object.fromEntries(keys.slice(-1200).map((k) => [k, cache[k]!])) : cache
    window.localStorage.setItem(STORE_KEY, JSON.stringify(trimmed))
  } catch {
    /* storage may be blocked — positions are then looked up again next time */
  }
}

function splitCities(label: string | null | undefined): string[] {
  return String(label ?? '')
    .split(/[·,،|/]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function centersFor(day: PublicItineraryDay, a: PublicItineraryActivity, destination: string): Array<[number, number]> {
  const labels = [...splitCities(a.locationLabel), ...splitCities(day.cityLabel), destination]
  const out: Array<[number, number]> = []
  for (const l of labels) {
    const c = resolveCityCenter(l, destination)
    if (!out.some((o) => Math.abs(o[0] - c[0]) < 0.05 && Math.abs(o[1] - c[1]) < 0.05)) out.push(c)
  }
  return out.slice(0, 3)
}

/** Search one name inside a box around a city centre. Throws on network problems (retried next visit). */
async function searchNear(name: string, center: [number, number]): Promise<Coords> {
  const [lat, lng] = center
  const viewbox = [lng - BOX, lat + BOX, lng + BOX, lat - BOX].join(',')
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(name)}`,
    { headers: { Accept: 'application/json', 'Accept-Language': 'en,ar' } },
  )
  if (!res.ok) throw new Error(String(res.status))
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
  const la = Number(data[0]?.lat)
  const lo = Number(data[0]?.lon)
  return Number.isFinite(la) && Number.isFinite(lo) && data.length ? [la, lo] : null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useStopPositions(
  days: PublicItineraryDay[],
  destination: string,
  priorityDay: number | 'all',
): { points: StopPoint[]; total: number; pending: number } {
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
          centers: centersFor(day, activity, destination),
        })),
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
    const own = (j: Job) => j.activity.lat != null && j.activity.lng != null

    const run = async () => {
      const need = jobs.filter((j) => !own(j))
      if (!need.length) return
      queueMicrotask(() => !cancelled && setPending(need.length))

      // 1) places bank (server)
      const fromBank: Record<string, Coords> = {}
      try {
        const res = await fetch('/api/itinerary-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: need.map((j) => ({ key: j.key, bankId: j.activity.placesBankId ?? null, name: j.name, city: j.city })),
          }),
        })
        const json = (await res.json().catch(() => null)) as { positions?: Record<string, [number, number]> } | null
        for (const [k, v] of Object.entries(json?.positions ?? {})) {
          if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) fromBank[k] = [v[0], v[1]]
        }
      } catch {
        /* fall through to the search */
      }
      if (cancelled) return

      // 2) remembered searches on this device
      const cache = readStore()
      const known: Record<string, Coords> = { ...fromBank }
      const todo: Job[] = []
      for (const j of need) {
        if (known[j.key]) continue
        const ck = `${j.name}|${j.centers.map((c) => c.join(',')).join(';')}`
        if (ck in cache) known[j.key] = cache[ck]!
        else todo.push(j)
      }
      setFound(known)
      setPending(todo.length)

      // 3) OpenStreetMap search near the stop's city, one per second, the chosen day first
      const left = [...todo]
      const done = new Map<string, Coords>() // same name + area → one search
      while (left.length && !cancelled) {
        const p = priorityRef.current
        const idx = p === 'all' ? 0 : Math.max(0, left.findIndex((j) => j.dayIndex === p))
        const j = left.splice(idx, 1)[0]!
        const ck = `${j.name}|${j.centers.map((c) => c.join(',')).join(';')}`
        let value: Coords | undefined = done.get(ck)
        if (value === undefined) {
          value = null
          try {
            for (const c of j.centers) {
              value = await searchNear(j.name, c)
              await sleep(1100)
              if (value || cancelled) break
            }
            cache[ck] = value
            writeStore(cache)
            done.set(ck, value)
          } catch {
            await sleep(1100) // network problem: not remembered, tried again next visit
          }
        }
        if (cancelled) return
        const v = value
        setFound((prev) => ({ ...prev, [j.key]: v }))
        setPending(left.length)
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
      const c = own ?? found[j.key] ?? null
      if (c) points.push({ dayIndex: j.dayIndex, order: j.order, activity: j.activity, lat: c[0], lng: c[1] })
    }
    return { points, total: jobs.length, pending }
  }, [jobs, found, pending])
}
