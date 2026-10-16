'use client'

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import type { PublicItineraryDay } from '@/lib/public-itinerary'
import type { VipMapMarker } from '@/lib/vip-map-coordinates'
import type { DaySelection } from './DayStrip'
import { cityOf, placeName, projectPoints, RV, seeded, smoothPath, type XY } from './route-utils'

/**
 * Stylised (non-geographic) route map — used when the destination has no outline data
 * yet, or while it is loading / offline. Same interactions as the real map.
 */

const W = 400
const H = 430
const PAD = { t: 112, r: 46, b: 92, l: 46 }

function hashOf(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h || 1
}

/** Decorative topographic rings — quiet texture that changes per city. */
function Contours({ seed }: { seed: string }) {
  const paths = useMemo(() => {
    const rnd = seeded(hashOf(seed))
    const out: string[] = []
    for (let c = 0; c < 3; c++) {
      const cx = 60 + rnd() * (W - 120)
      const cy = 120 + rnd() * (H - 200)
      const rings = 4 + Math.floor(rnd() * 3)
      const wob = Array.from({ length: 8 }, () => 0.75 + rnd() * 0.5)
      for (let r = 1; r <= rings; r++) {
        const R = 22 * r + rnd() * 6
        const pts = Array.from({ length: 16 }, (_, k) => {
          const a = (k / 16) * Math.PI * 2
          const f = wob[k % 8]!
          return {
            x: cx + Math.cos(a) * R * f * 1.25,
            y: cy + Math.sin(a) * R * f,
          }
        })
        out.push(smoothPath([...pts, pts[0]!, pts[1]!]))
      }
    }
    return out
  }, [seed])
  return (
    <g opacity={0.5}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" style={{ stroke: 'var(--map-border)' }} strokeWidth={1} />
      ))}
    </g>
  )
}

function Grid() {
  return (
    <g opacity={0.35}>
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={H} style={{ stroke: 'var(--rv-faint)' }} />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 40} x2={W} y2={i * 40} style={{ stroke: 'var(--rv-faint)' }} />
      ))}
    </g>
  )
}

/** Push apart pins that would overlap (dense city days), keeping them inside the frame. */
function separatePins(input: XY[], min = 40): XY[] {
  const p = input.map((q) => ({ ...q }))
  for (let it = 0; it < 60; it++) {
    let moved = false
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!
        const b = p[j]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        if (dist >= min) continue
        if (dist < 0.01) {
          const ang = (j / p.length) * Math.PI * 2
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          dist = 1
        }
        const push = (min - dist) / 2
        const ux = dx / dist
        const uy = dy / dist
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
        moved = true
      }
    }
    for (const q of p) {
      q.x = Math.min(W - PAD.r + 20, Math.max(PAD.l - 20, q.x))
      q.y = Math.min(H - PAD.b + 20, Math.max(PAD.t + 4, q.y))
    }
    if (!moved) break
  }
  return p
}

function DayLayer({
  markers,
  color,
  selectedStopId,
  onSelectStop,
}: {
  markers: VipMapMarker[]
  color: string
  selectedStopId: string | null
  onSelectStop: (id: string | null) => void
}) {
  const pts: XY[] = useMemo(() => separatePins(projectPoints(markers, W, H, PAD)), [markers])
  const d = useMemo(() => smoothPath(pts), [pts])
  const selIdx = markers.findIndex((m) => m.activity.id === selectedStopId)

  return (
    <g>
      {d ? (
        <>
          <motion.path
            d={d}
            fill="none"
            style={{ stroke: color }}
            strokeOpacity={0.22}
            strokeWidth={10}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d={d}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={2.2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
          />
        </>
      ) : null}

      {/* travel time between stops */}
      {pts.map((p, i) => {
        if (i === 0) return null
        const a = pts[i - 1]!
        const len = Math.hypot(p.x - a.x, p.y - a.y)
        const dur = markers[i]!.activity.transitDuration?.trim()
        if (!dur || len < 80) return null
        const mx = (a.x + p.x) / 2
        const my = (a.y + p.y) / 2
        // never cover a pin
        if (pts.some((q) => Math.hypot(q.x - mx, q.y - my) < 34)) return null
        const w = Math.min(140, 22 + dur.length * 7.4)
        return (
          <motion.g key={`t${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.05 }}>
            <rect x={mx - w / 2} y={my - 11} width={w} height={22} rx={11} style={{ fill: RV.glassStrong, stroke: RV.line }} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} style={{ fill: RV.muted }}>
              {dur}
            </text>
          </motion.g>
        )
      })}

      {pts.map((p, i) => {
        const m = markers[i]!
        const sel = i === selIdx
        return (
          <motion.g
            key={m.activity.id}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.15 + i * 0.12,
              type: 'spring',
              stiffness: 260,
              damping: 18,
            }}
            style={{ transformOrigin: `${p.x}px ${p.y}px`, cursor: 'pointer' }}
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
            <circle cx={p.x} cy={p.y} r={sel ? 18 : 14} style={{ fill: color, stroke: 'var(--map-pin-ring)' }} strokeWidth={3} />
            <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize={sel ? 14 : 12} fontWeight={800} style={{ fill: RV.onGold }}>
              {m.order}
            </text>
            {/* invisible larger hit area for fingers */}
            <circle cx={p.x} cy={p.y} r={24} fill="transparent" />
          </motion.g>
        )
      })}

      {selIdx >= 0 && pts[selIdx] ? <PinLabel p={pts[selIdx]!} text={placeName(markers[selIdx]!.activity)} /> : null}
    </g>
  )
}

function PinLabel({ p, text }: { p: XY; text: string }) {
  const t = text.length > 22 ? `${text.slice(0, 21)}…` : text
  const w = Math.min(220, 26 + t.length * 8.2)
  const above = p.y > 170
  const x = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, p.x))
  const y = above ? p.y - 40 : p.y + 40
  return (
    <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={text}>
      <rect x={x - w / 2} y={y - 15} width={w} height={30} rx={10} style={{ fill: RV.glassStrong, stroke: RV.lineStrong }} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: RV.cream }}>
        {t}
      </text>
    </motion.g>
  )
}

function OverviewLayer({
  days,
  destination,
  markersByDay,
  cityColors,
  onSelectDay,
}: {
  days: PublicItineraryDay[]
  destination: string
  markersByDay: VipMapMarker[][]
  cityColors: Map<string, string>
  onSelectDay: (s: DaySelection) => void
}) {
  const layout = useMemo(() => {
    const flat: Array<{ lat: number; lng: number; day: number }> = []
    markersByDay.forEach((ms, di) => ms.forEach((m) => flat.push({ lat: m.lat, lng: m.lng, day: di })))
    const xy = projectPoints(flat, W, H, { t: 112, r: 54, b: 70, l: 54 }, 0.05)
    // consecutive days in the same city form a group
    const groups: Array<{ city: string; from: number; to: number; pts: XY[] }> = []
    days.forEach((d, i) => {
      const city = cityOf(d, destination)
      const last = groups[groups.length - 1]
      if (last && last.city === city) last.to = i
      else groups.push({ city, from: i, to: i, pts: [] })
    })
    flat.forEach((f, k) => {
      const g = groups.find((gr) => f.day >= gr.from && f.day <= gr.to)
      g?.pts.push(xy[k]!)
    })
    const centers = groups.map((g) => {
      if (g.pts.length === 0) return { x: W / 2, y: H / 2 }
      return {
        x: g.pts.reduce((s, p) => s + p.x, 0) / g.pts.length,
        y: g.pts.reduce((s, p) => s + p.y, 0) / g.pts.length,
      }
    })
    return { flat, xy, groups, centers }
  }, [days, destination, markersByDay])

  const journey = smoothPath(layout.centers)

  return (
    <g>
      {journey ? (
        <motion.path
          d={journey}
          fill="none"
          style={{ stroke: RV.gold }}
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeDasharray="6 7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
      ) : null}
      {layout.xy.map((p, k) => {
        const day = days[layout.flat[k]!.day]!
        const c = cityColors.get(cityOf(day, destination)) ?? RV.gold
        return <circle key={k} cx={p.x} cy={p.y} r={3.2} style={{ fill: c }} opacity={0.85} />
      })}
      {layout.groups.map((g, i) => {
        const c = layout.centers[i]!
        const color = cityColors.get(g.city) ?? RV.gold
        const range = g.from === g.to ? `اليوم ${g.from + 1}` : `اليوم ${g.from + 1}–${g.to + 1}`
        const w = Math.max(84, 22 + g.city.length * 11)
        return (
          <motion.g
            key={`g${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectDay(g.from)}
          >
            <circle cx={c.x} cy={c.y} r={7} style={{ fill: color, stroke: 'var(--map-pin-ring)' }} strokeWidth={2.5} />
            <rect x={c.x - w / 2} y={c.y - 52} width={w} height={36} rx={10} style={{ fill: RV.glassStrong, stroke: color }} strokeOpacity={0.6} />
            <text x={c.x} y={c.y - 36} textAnchor="middle" fontSize={13} fontWeight={800} style={{ fill: RV.cream }}>
              {g.city}
            </text>
            <text x={c.x} y={c.y - 22} textAnchor="middle" fontSize={9.5} fontWeight={700} style={{ fill: color }}>
              {range}
            </text>
          </motion.g>
        )
      })}
    </g>
  )
}

export default function StylisedMap({
  days,
  destination,
  selected,
  markersByDay,
  cityColors,
  selectedStopId,
  onSelectDay,
  onSelectStop,
}: {
  days: PublicItineraryDay[]
  destination: string
  selected: DaySelection
  markersByDay: VipMapMarker[][]
  cityColors: Map<string, string>
  selectedStopId: string | null
  onSelectDay: (s: DaySelection) => void
  onSelectStop: (id: string | null) => void
}) {
  const isAll = selected === 'all'
  const day = isAll ? null : days[selected]
  const city = day ? cityOf(day, destination) : destination
  const color = cityColors.get(city) ?? RV.gold
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`خريطة ${isAll ? 'الرحلة كاملة' : city}`}
    >
      <rect width={W} height={H} style={{ fill: 'var(--map-sea)' }} />
      <Grid />
      <Contours seed={isAll ? destination : city} />
      <AnimatePresence mode="wait">
        <motion.g
          key={isAll ? 'all' : `d${selected}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35 }}
          style={{ transformOrigin: '200px 230px' }}
        >
          {isAll ? (
            <OverviewLayer days={days} destination={destination} markersByDay={markersByDay} cityColors={cityColors} onSelectDay={onSelectDay} />
          ) : (
            <DayLayer markers={markersByDay[selected] ?? []} color={color} selectedStopId={selectedStopId} onSelectStop={onSelectStop} />
          )}
        </motion.g>
      </AnimatePresence>
    </svg>
  )
}
