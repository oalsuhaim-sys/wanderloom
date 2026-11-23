'use client'

import { useCallback, useEffect, useState } from 'react'

import { ratingSlot, type StopRatingsMap } from '@/lib/stop-ratings'

/** The client's star ratings for this itinerary (saved on the server, shown instantly). */
export function useStopRatings(tripId: string) {
  const [ratings, setRatings] = useState<StopRatingsMap>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [visited, setVisitedMap] = useState<Record<string, true>>({})

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/itinerary/${encodeURIComponent(tripId)}/ratings`, { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as {
          ratings?: StopRatingsMap
          notes?: Record<string, string>
          visited?: Record<string, true>
        } | null
        if (cancelled) return
        if (json?.ratings) setRatings((prev) => ({ ...json.ratings, ...prev }))
        if (json?.notes) setNotes((prev) => ({ ...json.notes, ...prev }))
        if (json?.visited) setVisitedMap((prev) => ({ ...json.visited, ...prev }))
      } catch {
        /* ratings are optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tripId])

  const rate = useCallback(
    async (dayIndex: number, stopKey: string, value: number, meta: { placeName?: string; bankId?: string | null }) => {
      const slot = ratingSlot(dayIndex, stopKey)
      let previous: number | undefined
      setRatings((r) => {
        previous = r[slot]
        return { ...r, [slot]: value }
      })
      try {
        const res = await fetch(`/api/itinerary/${encodeURIComponent(tripId)}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayIndex, stopKey, rating: value, placeName: meta.placeName, bankId: meta.bankId }),
        })
        if (!res.ok) throw new Error(String(res.status))
        setVisitedMap((m) => ({ ...m, [slot]: true }))
        return true
      } catch {
        setRatings((r) => {
          const next = { ...r }
          if (previous == null) delete next[slot]
          else next[slot] = previous
          return next
        })
        return false
      }
    },
    [tripId],
  )

  const saveNote = useCallback(
    async (dayIndex: number, stopKey: string, note: string, meta: { placeName?: string; bankId?: string | null }) => {
      try {
        const res = await fetch(`/api/itinerary/${encodeURIComponent(tripId)}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayIndex, stopKey, note, placeName: meta.placeName, bankId: meta.bankId }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const slot = ratingSlot(dayIndex, stopKey)
        setNotes((n) => {
          const next = { ...n }
          if (note.trim()) next[slot] = note.trim()
          else delete next[slot]
          return next
        })
        return true
      } catch {
        return false
      }
    },
    [tripId],
  )

  /** «زرت المكان ✓» on / off — shown at once, undone if the save fails. */
  const setVisited = useCallback(
    async (dayIndex: number, stopKey: string, value: boolean, meta: { placeName?: string; bankId?: string | null }) => {
      const slot = ratingSlot(dayIndex, stopKey)
      const apply = (on: boolean) =>
        setVisitedMap((m) => {
          const next = { ...m }
          if (on) next[slot] = true
          else delete next[slot]
          return next
        })
      apply(value)
      try {
        const res = await fetch(`/api/itinerary/${encodeURIComponent(tripId)}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayIndex, stopKey, visited: value, placeName: meta.placeName, bankId: meta.bankId }),
        })
        if (!res.ok) throw new Error(String(res.status))
        return true
      } catch {
        apply(!value)
        return false
      }
    },
    [tripId],
  )

  return { ratings, rate, notes, saveNote, visited, setVisited }
}

/** Has this trip day started (local date)? */
export function dayHasStarted(startDate: string | null | undefined, dayIndex: number): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate ?? ''))
  if (!m) return false
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dayIndex)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return day.getTime() <= today.getTime()
}
