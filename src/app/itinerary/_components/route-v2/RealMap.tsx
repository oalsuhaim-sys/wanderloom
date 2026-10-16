'use client'

import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import type { VipMapMarker } from '@/lib/vip-map-coordinates'
import type { DaySelection } from './DayStrip'
import { projectLatLng, regionAt, ringsToPath, type CountryGeo } from './geo'
import { cityOf, placeName, RV, smoothPath, type XY } from './route-utils'

/**
 * Real geographic route map.
 * - Country / prefecture outlines drawn as inline SVG paths (pre-built from open data).
 * - No map library: the view (centre + scale) is animated with a small "fly" tween, and the
 *   SVG viewBox follows it — zooming out a little between far-apart days, then in.
 * - Pins, labels and the route are drawn in screen space on top, so they stay crisp at any zoom.
 */

type Props = {
  geo: CountryGeo
  days: PublicItineraryDay[]
  destination: string
  selected: DaySelection
  markersByDay: VipMapMarker[][]
  cityColors: Map<string, string>
  selectedStopId: string | null
  onSelectDay: (s: DaySelection) => void
  onSelectStop: (id: string | null) => void
}

type View = { cx: number; cy: number; s: number }
type Size = { w: number; h: number }
type Box = [number, number, number, number]

/** Space kept free for the header (top) and the controls (bottom), in px. */
const SAFE = { t: 104, r: 30, b: 84, l: 30 }
/** Smallest area a day zooms to (projected units: 1 = 0.001°). */
const MIN_DAY_SPAN = 55
const MIN_TRIP_SPAN = 2400

function boundsOf(pts: Array<[number, number]>): Box | null {
  if (pts.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

function union(a: Box, b: Box): Box {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

function grow(b: Box, minSpan: number, padFrac: number): Box {
  const cx = (b[0] + b[2]) / 2
  const cy = (b[1] + b[3]) / 2
  const w = Math.max(b[2] - b[0], minSpan) * (1 + padFrac * 2)
  const h = Math.max(b[3] - b[1], minSpan) * (1 + padFrac * 2)
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
}

/** View that fits `b` inside the safe area of the card. */
function fit(b: Box, size: Size): View {
  const aw = Math.max(40, size.w - SAFE.l - SAFE.r)
  const ah = Math.max(40, size.h - SAFE.t - SAFE.b)
  const s = Math.min(aw / (b[2] - b[0]), ah / (b[3] - b[1]))
  const bcx = (b[0] + b[2]) / 2
  const bcy = (b[1] + b[3]) / 2
  // centre of the safe area, relative to the card centre
  const ox = (SAFE.l - SAFE.r) / 2
  const oy = (SAFE.t - SAFE.b) / 2
  return { cx: bcx - ox / s, cy: bcy - oy / s, s }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Animated view: flies from the current view to `target`. */
function useFlyTo(target: View, size: Size): View {
  const [view, setView] = useState<View>(target)
  const current = useRef<View>(target)
  const first = useRef(true)
  const lastSize = useRef(`${size.w}x${size.h}`)

  useEffect(() => {
    const from = current.current
    const to = target
    let raf = 0
    const sizeKey = `${size.w}x${size.h}`
    if (first.current || lastSize.current !== sizeKey) {
      first.current = false
      lastSize.current = sizeKey
      raf = requestAnimationFrame(() => {
        current.current = to
        setView(to)
      })
      return () => cancelAnimationFrame(raf)
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy)
    const wideUnits = size.w / Math.min(from.s, to.s)
    const zoomRatio = Math.abs(Math.log(to.s / from.s))
    // zoom out on the way when the next area is far from the current one
    const bump = dist > wideUnits * 0.45 ? Math.log(dist / (wideUnits * 0.45)) * 0.75 : 0
    const duration = reduce ? 1 : Math.min(1700, 650 + 260 * zoomRatio + 380 * bump)
    const t0 = performance.now()
    const ls0 = Math.log(from.s)
    const ls1 = Math.log(to.s)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const e = easeInOut(t)
      const v: View = {
        cx: from.cx + (to.cx - from.cx) * e,
        cy: from.cy + (to.cy - from.cy) * e,
        s: Math.exp(ls0 + (ls1 - ls0) * e - bump * Math.sin(Math.PI * e)),
      }
      current.current = v
      setView(v)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the target changes
  }, [target.cx, target.cy, target.s])

  return view
}

/** Push apart pins that would overlap; returns screen offsets per pin. */
function separate(pts: XY[], min: number, size: Size): XY[] {
  const p = pts.map((q) => ({ ...q }))
  for (let it = 0; it < 80; it++) {
    let moved = false
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!
        const b = p[j]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= min) continue
        if (d < 0.01) {
          const ang = (j / p.length) * Math.PI * 2
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          d = 1
        }
        const push = (min - d) / 2
        a.x -= (dx / d) * push
        a.y -= (dy / d) * push
        b.x += (dx / d) * push
        b.y += (dy / d) * push
        moved = true
      }
    }
    for (const q of p) {
      q.x = Math.min(size.w - 22, Math.max(22, q.x))
      q.y = Math.min(size.h - SAFE.b + 10, Math.max(SAFE.t - 6, q.y))
    }
    if (!moved) break
  }
  return p.map((q, i) => ({ x: q.x - pts[i]!.x, y: q.y - pts[i]!.y }))
}

/* ------------------------------------------------------------------ base map */

type BaseProps = {
  land: string
  neighbors: string
  borders: string
  rivers: string
  lakes: string
  urban: string
  showUrban: boolean
  zoomedOut: boolean
  active: string
  activeKey: string
}

/** The geography itself. Memoised: only the parent's viewBox changes while flying. */
const BaseMap = memo(function BaseMap({ land, neighbors, borders, rivers, lakes, urban, showUrban, zoomedOut, active, activeKey }: BaseProps) {
  return (
    <g>
      <path d={neighbors} style={{ fill: 'var(--map-land-other)', stroke: 'var(--map-border)' }} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {/* soft coastal glow */}
      <path d={land} fill="none" style={{ stroke: 'var(--map-coast)' }} strokeOpacity={0.2} strokeWidth={8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={land} style={{ fill: 'var(--map-land)' }} />
      {active ? (
        <motion.path
          key={activeKey}
          d={active}
          style={{ fill: 'var(--map-land-active)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
      ) : null}
      <path d={urban} style={{ fill: 'var(--map-urban)', opacity: showUrban ? 1 : 0, transition: 'opacity 400ms' }} />
      <path d={lakes} style={{ fill: 'var(--map-water)', stroke: 'var(--map-river)' }} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      <path d={rivers} fill="none" style={{ stroke: 'var(--map-river)' }} strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d={borders}
        fill="none"
        style={{ stroke: 'var(--map-border)', opacity: zoomedOut ? 0.45 : 1, transition: 'opacity 400ms' }}
        strokeWidth={1}
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />
      <path d={land} fill="none" style={{ stroke: 'var(--map-coast)' }} strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  )
})

/** 青海波 seigaiha — overlapping wave scales for the sea, kept at a constant size. */
function SeaPattern({ id, tx, ty }: { id: string; tx: number; ty: number }) {
  const R = 14
  const rows: Array<[number, number]> = [
    [0, 0],
    [2 * R, 0],
    [R, R / 2],
    [0, R],
    [2 * R, R],
  ]
  return (
    <pattern id={id} width={2 * R} height={R} patternUnits="userSpaceOnUse" patternTransform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)})`}>
      <rect width={2 * R} height={R} style={{ fill: 'var(--map-sea)' }} />
      {rows.map(([x, y], i) => (
        <g key={i}>
          {[R, R * 0.72, R * 0.44, R * 0.16].map((r, k) => (
            <circle key={k} cx={x} cy={y} r={r} style={{ fill: k === 0 ? 'var(--map-sea)' : 'none', stroke: 'var(--map-wave)' }} strokeWidth={1} />
          ))}
        </g>
      ))}
    </pattern>
  )
}

/* ------------------------------------------------------------------ layout helpers */

type Rect = [number, number, number, number]

const screenAt = (v: View, size: Size, x: number, y: number): XY => ({ x: (x - v.cx) * v.s + size.w / 2, y: (y - v.cy) * v.s + size.h / 2 })
const overlaps = (a: Rect, b: Rect) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
const isLatin = (t: string) => /^[\x20-\x7EÀ-ɏ]+$/.test(t)
/** Rough text width in px for the label font sizes used on the map. */
const textW = (t: string, px: number) => t.length * px * (isLatin(t) ? 0.58 : 0.55)

function insideCard(r: Rect, size: Size, top = SAFE.t - 10): boolean {
  return r[0] >= 8 && r[2] <= size.w - 8 && r[1] >= top && r[3] <= size.h - SAFE.b + 6
}

type Group = { city: string; from: number; to: number; c: [number, number] }
type Chip = { g: Group; dot: XY; box: Rect; color: string }
type StopLabel = { x: number; y: number; anchor: 'start' | 'end' | 'middle'; text: string }

/* ------------------------------------------------------------------ component */

export default function RealMap({ geo, days, destination, selected, markersByDay, cityColors, selectedStopId, onSelectDay, onSelectStop }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ w: 400, h: 440 })
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isAll = selected === 'all'

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) setSize((s) => (Math.abs(s.w - r.width) > 1 || Math.abs(s.h - r.height) > 1 ? { w: r.width, h: r.height } : s))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // static geometry → path strings (once per country)
  const paths = useMemo(
    () => ({
      land: ringsToPath(geo.land),
      neighbors: ringsToPath(geo.neighbors),
      borders: ringsToPath(geo.borders, false),
      rivers: ringsToPath(geo.rivers, false),
      lakes: ringsToPath(geo.lakes),
      urban: ringsToPath(geo.urban),
    }),
    [geo],
  )

  const proj = useMemo(() => markersByDay.map((ms) => ms.map((m) => projectLatLng(geo, m.lat, m.lng))), [geo, markersByDay])
  const allPts = useMemo(() => proj.flat(), [proj])

  // which prefecture / province the day is in
  const activeRegion = useMemo(() => {
    if (isAll) return -1
    const counts = new Map<number, number>()
    for (const p of proj[selected] ?? []) {
      const r = regionAt(geo, p)
      if (r >= 0) counts.set(r, (counts.get(r) ?? 0) + 1)
    }
    let best = -1
    let n = 0
    counts.forEach((c, r) => {
      if (c > n) {
        n = c
        best = r
      }
    })
    return best
  }, [geo, proj, selected, isAll])
  const activePath = useMemo(() => (activeRegion >= 0 ? ringsToPath(geo.regions[activeRegion]!.r) : ''), [geo, activeRegion])

  const target = useMemo<View>(() => {
    if (isAll) {
      const mb = boundsOf(allPts)
      const focus = geo.focus as Box
      const b = mb ? union(focus, grow(mb, MIN_TRIP_SPAN, 0.08)) : focus
      return fit(grow(b, 0, 0.02), size)
    }
    const db = boundsOf(proj[selected] ?? [])
    if (db) return fit(grow(db, MIN_DAY_SPAN, 0.16), size)
    // a free day without stops: the whole country
    return fit(geo.focus as Box, size)
  }, [isAll, allPts, proj, selected, geo, size])

  const view = useFlyTo(target, size)
  const { w, h } = size
  const vb = `${(view.cx - w / (2 * view.s)).toFixed(2)} ${(view.cy - h / (2 * view.s)).toFixed(2)} ${(w / view.s).toFixed(2)} ${(h / view.s).toFixed(2)}`
  const toScreen = (x: number, y: number): XY => screenAt(view, size, x, y)

  // consecutive days in the same city form one stop on the journey
  const groups = useMemo<Group[]>(() => {
    const gs: Array<{ city: string; from: number; to: number; pts: Array<[number, number]> }> = []
    days.forEach((d, i) => {
      const city = cityOf(d, destination)
      const last = gs[gs.length - 1]
      if (last && last.city === city) {
        last.to = i
        last.pts.push(...(proj[i] ?? []))
      } else gs.push({ city, from: i, to: i, pts: [...(proj[i] ?? [])] })
    })
    return gs
      .filter((g) => g.pts.length > 0)
      .map((g) => ({
        city: g.city,
        from: g.from,
        to: g.to,
        c: [g.pts.reduce((s, p) => s + p[0], 0) / g.pts.length, g.pts.reduce((s, p) => s + p[1], 0) / g.pts.length] as [number, number],
      }))
  }, [days, destination, proj])

  // ---- overview chips: placed around their dot without colliding (Tokyo / Hakone are close)
  const chips = useMemo<Chip[]>(() => {
    if (!isAll) return []
    const dots = groups.map((g) => screenAt(target, size, g.c[0], g.c[1]))
    const placed: Chip[] = []
    const seen = new Set<string>()
    groups.forEach((g, i) => {
      if (seen.has(g.city)) return // a city visited twice keeps one label
      seen.add(g.city)
      const range = groups.filter((x) => x.city === g.city)
      const label = `${g.city}`
      const cw = Math.max(74, textW(label, 13) + 26)
      const ch = 34
      const d = dots[i]!
      const cands: Array<[number, number]> = [
        [0, -36],
        [0, 36],
        [cw / 2 + 16, 0],
        [-(cw / 2 + 16), 0],
        [cw / 2 + 6, -30],
        [-(cw / 2 + 6), -30],
        [cw / 2 + 6, 30],
        [-(cw / 2 + 6), 30],
        [0, -74],
        [0, 74],
        [cw + 20, 0],
        [-(cw + 20), 0],
      ]
      let box: Rect | null = null
      for (const [dx, dy] of cands) {
        const r: Rect = [d.x + dx - cw / 2, d.y + dy - ch / 2, d.x + dx + cw / 2, d.y + dy + ch / 2]
        if (!insideCard(r, size, SAFE.t - 4)) continue
        if (placed.some((p) => overlaps(r, p.box))) continue
        if (dots.some((q) => q.x > r[0] - 9 && q.x < r[2] + 9 && q.y > r[1] - 9 && q.y < r[3] + 9)) continue
        box = r
        break
      }
      if (!box) box = [d.x - cw / 2, d.y - 36 - ch / 2, d.x + cw / 2, d.y - 36 + ch / 2]
      const from = Math.min(...range.map((x) => x.from))
      const to = Math.max(...range.map((x) => x.to))
      placed.push({ g: { ...g, from, to }, dot: d, box, color: cityColors.get(g.city) ?? RV.gold })
    })
    return placed
  }, [isAll, groups, target, size, cityColors])

  // ---- pins of the day: decided for the final view (no jitter while flying)
  const dayMarkers = useMemo(() => (isAll ? [] : (markersByDay[selected] ?? [])), [isAll, markersByDay, selected])
  const dayProj = useMemo(() => (isAll ? [] : (proj[selected] ?? [])), [isAll, proj, selected])
  const pinLayout = useMemo(() => {
    const real = dayProj.map(([x, y]) => screenAt(target, size, x, y))
    const offsets = separate(real, 36, size)
    const shown = real.map((p, i) => ({ x: p.x + offsets[i]!.x, y: p.y + offsets[i]!.y }))
    // short name next to each pin, on whichever side is free
    const taken: Rect[] = shown.map((p) => [p.x - 17, p.y - 17, p.x + 17, p.y + 17])
    const names: Array<StopLabel | null> = shown.map((p, i) => {
      if (shown.length > 7) return null
      const raw = placeName(dayMarkers[i]!.activity)
      const text = raw.length > 18 ? `${raw.slice(0, 17)}…` : raw
      const tw = textW(text, 11) + 6
      const opts: Array<[Rect, StopLabel]> = [
        // the map is RTL: `start` is the right edge of the text, `end` the left edge
        [[p.x - 20 - tw, p.y - 8, p.x - 20, p.y + 8], { x: p.x - 21, y: p.y + 4, anchor: 'start', text }],
        [[p.x + 20, p.y - 8, p.x + 20 + tw, p.y + 8], { x: p.x + 21, y: p.y + 4, anchor: 'end', text }],
        [[p.x - tw / 2, p.y + 20, p.x + tw / 2, p.y + 36], { x: p.x, y: p.y + 32, anchor: 'middle', text }],
        [[p.x - tw / 2, p.y - 36, p.x + tw / 2, p.y - 20], { x: p.x, y: p.y - 24, anchor: 'middle', text }],
      ]
      for (const [r, l] of opts) {
        if (!insideCard(r, size)) continue
        if (taken.some((t) => overlaps(r, t))) continue
        taken.push(r)
        return l
      }
      return null
    })
    // keep context labels off the travel-time chips drawn between far-apart stops
    for (let i = 1; i < shown.length; i++) {
      const a = shown[i - 1]!
      const p = shown[i]!
      if (Math.hypot(p.x - a.x, p.y - a.y) < 110) continue
      const mx = (a.x + p.x) / 2
      const my = (a.y + p.y) / 2
      taken.push([mx - 70, my - 12, mx + 70, my + 12])
    }
    return { offsets, names, taken }
  }, [dayProj, dayMarkers, target, size])

  const pattern = `sea${uid}`
  const tx = (((-view.cx * view.s + w / 2) % 28) + 28) % 28
  const ty = (((-view.cy * view.s + h / 2) % 14) + 14) % 14

  const day = isAll ? null : days[selected]
  const color = day ? (cityColors.get(cityOf(day, destination)) ?? RV.gold) : RV.gold

  // ---- context labels (prefectures, cities) that stay clear of pins, names and chips
  const labels = useMemo(() => {
    const out: Array<{ x: number; y: number; text: string; kind: 'place' | 'region' }> = []
    const taken: Rect[] = isAll ? chips.map((c) => c.box) : [...pinLayout.taken]
    const dots = isAll ? allPts.map(([x, y]) => screenAt(target, size, x, y)) : []
    const tryPlace = (x: number, y: number, tw: number, th: number) => {
      const r: Rect = [x - tw / 2 - 3, y - th, x + tw / 2 + 3, y + 4]
      if (!insideCard(r, size)) return false
      if (taken.some((t) => overlaps(r, t))) return false
      if (dots.some((q) => q.x > r[0] - 10 && q.x < r[2] + 10 && q.y > r[1] - 10 && q.y < r[3] + 10)) return false
      taken.push(r)
      return true
    }
    if (!isAll) {
      geo.regions.forEach((r, i) => {
        if (i === activeRegion || out.length >= 4) return
        const name = (r.l || r.en || '').trim()
        if (!name) return
        const p = screenAt(target, size, r.p[0], r.p[1])
        const text = isLatin(name) ? name.toUpperCase() : name
        if (tryPlace(p.x, p.y, textW(text, isLatin(text) ? 10 : 14), 14)) out.push({ x: p.x, y: p.y, text, kind: 'region' })
      })
    }
    let placed = 0
    const limit = isAll ? 4 : 4
    for (const pl of geo.places) {
      if (placed >= limit) break
      const p = screenAt(target, size, pl.x, pl.y)
      if (tryPlace(p.x, p.y - 7, textW(pl.n, 10) + 4, 12)) {
        out.push({ x: p.x, y: p.y, text: pl.n, kind: 'place' })
        placed++
      }
    }
    return out
  }, [geo, target, size, isAll, chips, allPts, pinLayout, activeRegion])

  // labels fade in once the flight has (nearly) landed
  const landed = Math.abs(Math.log(view.s / target.s)) < 0.04 && Math.hypot(view.cx - target.cx, view.cy - target.cy) * view.s < 6
  // urban areas only read well when zoomed in to a city
  const showUrban = target.s > 0.35

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {/* sea */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <SeaPattern id={pattern} tx={tx} ty={ty} />
          <radialGradient id={`vg${uid}`} cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="black" stopOpacity={0} />
            <stop offset="100%" stopColor="black" stopOpacity={0.28} />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pattern})`} />
      </svg>

      {/* geography (zoomed through the viewBox) */}
      <svg className="absolute inset-0 h-full w-full" viewBox={vb} preserveAspectRatio="none" aria-hidden>
        <BaseMap {...paths} showUrban={showUrban} zoomedOut={target.s < 0.08} active={activePath} activeKey={`r${activeRegion}`} />
      </svg>

      {/* vignette for depth */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <rect width="100%" height="100%" fill={`url(#vg${uid})`} style={{ opacity: 'var(--map-vignette)' }} />
      </svg>

      {/* labels, route and pins — screen space */}
      <svg className="absolute inset-0 h-full w-full" role="img" aria-label={isAll ? 'خريطة الرحلة كاملة' : `خريطة ${day ? cityOf(day, destination) : ''}`}>
        <g style={{ opacity: landed ? 1 : 0, transition: 'opacity 380ms ease' }} pointerEvents="none">
          {labels.map((l, i) =>
            l.kind === 'region' ? (
              <text
                key={`l${i}`}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                fontSize={isLatin(l.text) ? 9.5 : 14}
                fontWeight={800}
                letterSpacing={isLatin(l.text) ? 1.6 : 3}
                style={{ fill: 'var(--map-label)', paintOrder: 'stroke', stroke: 'var(--map-label-halo)' }}
                strokeWidth={3}
                opacity={0.85}
              >
                {l.text}
              </text>
            ) : (
              <g key={`l${i}`}>
                <circle cx={l.x} cy={l.y} r={2.4} style={{ fill: 'var(--map-label)' }} />
                <text
                  x={l.x}
                  y={l.y - 7}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  style={{ fill: 'var(--map-label)', paintOrder: 'stroke', stroke: 'var(--map-label-halo)' }}
                  strokeWidth={3}
                >
                  {l.text}
                </text>
              </g>
            ),
          )}
        </g>

        {isAll ? (
          <Overview
            days={days}
            destination={destination}
            proj={proj}
            groups={groups}
            chips={chips}
            cityColors={cityColors}
            toScreen={toScreen}
            landed={landed}
            onSelectDay={onSelectDay}
          />
        ) : (
          <DayPins
            key={`day-${selected}`}
            markers={dayMarkers}
            proj={dayProj}
            offsets={pinLayout.offsets}
            names={pinLayout.names}
            color={color}
            toScreen={toScreen}
            landed={landed}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            width={w}
          />
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ day layer */

function DayPins({
  markers,
  proj,
  offsets,
  names,
  color,
  toScreen,
  landed,
  selectedStopId,
  onSelectStop,
  width,
}: {
  markers: VipMapMarker[]
  proj: Array<[number, number]>
  offsets: XY[]
  names: Array<StopLabel | null>
  color: string
  toScreen: (x: number, y: number) => XY
  landed: boolean
  selectedStopId: string | null
  onSelectStop: (id: string | null) => void
  width: number
}) {
  const real = proj.map(([x, y]) => toScreen(x, y))
  const shown = real.map((p, i) => ({ x: p.x + (offsets[i]?.x ?? 0), y: p.y + (offsets[i]?.y ?? 0) }))
  const d = smoothPath(shown)
  const selIdx = markers.findIndex((m) => m.activity.id === selectedStopId)

  return (
    <g>
      {d ? (
        <>
          <motion.path
            d={d}
            fill="none"
            style={{ stroke: color }}
            strokeOpacity={0.25}
            strokeWidth={9}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: landed ? 1 : 0 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d={d}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={2.4}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: landed ? 1 : 0 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
        </>
      ) : null}

      {/* leader lines when a pin had to move away from its true spot */}
      {shown.map((p, i) => {
        const r = real[i]!
        if (Math.hypot(p.x - r.x, p.y - r.y) < 7) return null
        return (
          <g key={`ld${i}`} opacity={landed ? 0.9 : 0} style={{ transition: 'opacity 300ms' }}>
            <line x1={r.x} y1={r.y} x2={p.x} y2={p.y} style={{ stroke: color }} strokeWidth={1.2} strokeDasharray="2 2" />
            <circle cx={r.x} cy={r.y} r={2.6} style={{ fill: color }} />
          </g>
        )
      })}

      {/* stop names */}
      <g style={{ opacity: landed ? 1 : 0, transition: 'opacity 450ms ease 250ms' }} pointerEvents="none">
        {names.map((n, i) =>
          n && i !== selIdx ? (
            <text
              key={`n${i}`}
              x={n.x}
              y={n.y}
              textAnchor={n.anchor}
              direction="rtl"
              fontSize={11}
              fontWeight={700}
              style={{ fill: RV.cream, paintOrder: 'stroke', stroke: 'var(--map-label-halo)' }}
              strokeWidth={3.5}
            >
              {n.text}
            </text>
          ) : null,
        )}
      </g>

      {/* travel time between stops */}
      {landed
        ? shown.map((p, i) => {
            if (i === 0) return null
            const a = shown[i - 1]!
            const dur = markers[i]?.activity.transitDuration?.trim()
            if (!dur || Math.hypot(p.x - a.x, p.y - a.y) < 110) return null
            const mx = (a.x + p.x) / 2
            const my = (a.y + p.y) / 2
            if (shown.some((q) => Math.hypot(q.x - mx, q.y - my) < 40)) return null
            const cw = Math.min(140, 22 + dur.length * 6.8)
            return (
              <motion.g key={`t${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.05 }} pointerEvents="none">
                <rect x={mx - cw / 2} y={my - 11} width={cw} height={22} rx={11} style={{ fill: RV.glassStrong, stroke: RV.line }} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: RV.muted }}>
                  {dur}
                </text>
              </motion.g>
            )
          })
        : null}

      {shown.map((p, i) => {
        const m = markers[i]!
        const sel = i === selIdx
        return (
          <motion.g
            key={m.activity.id}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: landed ? 1 : 0, scale: landed ? 1 : 0.6 }}
            transition={{ delay: landed ? 0.1 + i * 0.09 : 0, type: 'spring', stiffness: 260, damping: 18 }}
            style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: 'view-box', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectStop(sel ? null : m.activity.id)
            }}
          >
            {sel ? (
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={22}
                fill="none"
                style={{ stroke: color }}
                strokeWidth={2}
                initial={{ r: 16, opacity: 0.9 }}
                animate={{ r: 30, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            ) : null}
            <ellipse cx={p.x} cy={p.y + (sel ? 17 : 13)} rx={sel ? 11 : 8} ry={3} fill="black" opacity={0.22} />
            <circle cx={p.x} cy={p.y} r={sel ? 18 : 14} style={{ fill: color, stroke: 'var(--map-pin-ring)' }} strokeWidth={3} />
            <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize={sel ? 14 : 12} fontWeight={800} style={{ fill: RV.onGold }}>
              {m.order}
            </text>
            <circle cx={p.x} cy={p.y} r={24} fill="transparent" />
          </motion.g>
        )
      })}

      {selIdx >= 0 && shown[selIdx] && landed ? <PinLabel p={shown[selIdx]!} text={placeName(markers[selIdx]!.activity)} width={width} /> : null}
    </g>
  )
}

function PinLabel({ p, text, width }: { p: XY; text: string; width: number }) {
  const t = text.length > 24 ? `${text.slice(0, 23)}…` : text
  const w = Math.min(width - 24, 28 + textW(t, 13))
  const above = p.y > SAFE.t + 60
  const x = Math.min(width - w / 2 - 10, Math.max(w / 2 + 10, p.x))
  const y = above ? p.y - 42 : p.y + 42
  return (
    <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={text} pointerEvents="none">
      <rect x={x - w / 2} y={y - 15} width={w} height={30} rx={10} style={{ fill: RV.glassStrong, stroke: RV.lineStrong }} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: RV.cream }}>
        {t}
      </text>
    </motion.g>
  )
}

/* ------------------------------------------------------------------ overview */

function Overview({
  days,
  destination,
  proj,
  groups,
  chips,
  cityColors,
  toScreen,
  landed,
  onSelectDay,
}: {
  days: PublicItineraryDay[]
  destination: string
  proj: Array<Array<[number, number]>>
  groups: Group[]
  chips: Chip[]
  cityColors: Map<string, string>
  toScreen: (x: number, y: number) => XY
  landed: boolean
  onSelectDay: (s: DaySelection) => void
}) {
  const centers = groups.map((g) => toScreen(g.c[0], g.c[1]))
  // gentle arcs between consecutive cities
  let journey = ''
  for (let i = 1; i < centers.length; i++) {
    const a = centers[i - 1]!
    const b = centers[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 4) continue
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const bend = Math.min(50, len * 0.2)
    journey += `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${(mx + (-(b.y - a.y) / len) * bend).toFixed(1)} ${(my + ((b.x - a.x) / len) * bend).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)} `
  }

  return (
    <g>
      {journey ? (
        <path
          d={journey}
          fill="none"
          style={{ stroke: RV.gold, opacity: landed ? 0.8 : 0, transition: 'opacity 400ms' }}
          strokeWidth={2}
          strokeDasharray="6 7"
          className="wl-journey-dash"
        />
      ) : null}
      {proj.map((pts, di) => {
        const c = cityColors.get(cityOf(days[di]!, destination)) ?? RV.gold
        return pts.map(([x, y], k) => {
          const p = toScreen(x, y)
          return <circle key={`${di}-${k}`} cx={p.x} cy={p.y} r={2.8} style={{ fill: c }} opacity={0.8} />
        })
      })}
      {groups.map((g, i) => {
        const c = centers[i]!
        return (
          <circle
            key={`d${i}`}
            cx={c.x}
            cy={c.y}
            r={7.5}
            style={{ fill: cityColors.get(g.city) ?? RV.gold, stroke: 'var(--map-pin-ring)', cursor: 'pointer' }}
            strokeWidth={2.5}
            onClick={(e) => {
              e.stopPropagation()
              onSelectDay(g.from)
            }}
          />
        )
      })}
      {chips.map((ch, i) => {
        const [x0, y0, x1, y1] = ch.box
        const cx = (x0 + x1) / 2
        const cy = (y0 + y1) / 2
        // keep the chip attached to its city while the map flies
        const live = toScreen(ch.g.c[0], ch.g.c[1])
        const dx = live.x - ch.dot.x
        const dy = live.y - ch.dot.y
        const range = ch.g.from === ch.g.to ? `اليوم ${ch.g.from + 1}` : `اليوم ${ch.g.from + 1}–${ch.g.to + 1}`
        const near = { x: Math.min(x1, Math.max(x0, ch.dot.x)), y: Math.min(y1, Math.max(y0, ch.dot.y)) }
        return (
          <motion.g
            key={`c${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: landed ? 1 : 0 }}
            transition={{ delay: landed ? 0.1 + i * 0.08 : 0 }}
            transform={`translate(${dx.toFixed(1)} ${dy.toFixed(1)})`}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectDay(ch.g.from)
            }}
          >
            <line x1={ch.dot.x} y1={ch.dot.y} x2={near.x} y2={near.y} style={{ stroke: ch.color }} strokeOpacity={0.6} strokeWidth={1.2} />
            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={10} style={{ fill: RV.glassStrong, stroke: ch.color }} strokeOpacity={0.75} />
            <text x={cx} y={cy - 1} textAnchor="middle" fontSize={13} fontWeight={800} style={{ fill: RV.cream }}>
              {ch.g.city}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fontWeight={700} style={{ fill: ch.color }}>
              {range}
            </text>
          </motion.g>
        )
      })}
    </g>
  )
}
