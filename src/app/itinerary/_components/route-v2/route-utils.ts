import type { PublicItineraryActivity, PublicItineraryDay } from '@/lib/public-itinerary'

/**
 * Theme tokens for the route experience. Values are CSS variables defined in
 * globals.css (`.wl-theme` dark by default, `[data-theme='light']` for light),
 * so every component follows the client's chosen theme without re-rendering.
 */
export const RV = {
  page: 'var(--rv-page)',
  bg: 'var(--rv-bg)',
  card: 'var(--rv-card)',
  cardHi: 'var(--rv-card-hi)',
  inset: 'var(--rv-inset)',
  glass: 'var(--rv-glass)',
  glassStrong: 'var(--rv-glass-strong)',
  line: 'var(--rv-line)',
  lineStrong: 'var(--rv-line-strong)',
  gold: 'var(--rv-gold)',
  goldText: 'var(--rv-gold-text)',
  goldSoft: 'var(--rv-gold-soft)',
  goldTint: 'var(--rv-gold-tint)',
  goldTint2: 'var(--rv-gold-tint-2)',
  onGold: 'var(--rv-on-gold)',
  cream: 'var(--rv-cream)',
  text2: 'var(--rv-text-2)',
  muted: 'var(--rv-muted)',
  faint: 'var(--rv-faint)',
  shadow: 'var(--rv-shadow)',
} as const

/** Colours given to cities in order of first appearance (multi-city trips). */
const CITY_COLORS = [0, 1, 2, 3, 4, 5].map((i) => `var(--rv-city-${i})`)

const WEEKDAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] as const
const WEEKDAYS_LONG = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'] as const

/** Local-script city names shown as a quiet accent on the map (only where we are sure). */
const LOCAL_SCRIPT: Array<[RegExp, string]> = [
  [/طوكيو|tokyo/i, '東京'],
  [/كيوتو|kyoto/i, '京都'],
  [/أوساكا|اوساكا|osaka/i, '大阪'],
  [/هوكايدو|hokkaido/i, '北海道'],
  [/سابورو|sapporo/i, '札幌'],
  [/سيول|seoul/i, '서울'],
  [/بوسان|busan/i, '부산'],
  [/جيجو|jeju/i, '제주'],
  [/شنغهاي|shanghai/i, '上海'],
  [/بكين|beijing/i, '北京'],
]

export function localScriptFor(city: string): string | null {
  const c = city.trim()
  if (!c) return null
  for (const [re, label] of LOCAL_SCRIPT) if (re.test(c)) return label
  return null
}

function parseIso(startDate: string | null | undefined): Date | null {
  if (!startDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate).trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export type DayDateParts = {
  weekdayShort: string
  weekdayLong: string
  dayNum: number
  month: string
  monthIndex: number
  /** e.g. «الخميس، 17 ديسمبر» */
  long: string
}

export function dayDateParts(startDate: string | null | undefined, index: number): DayDateParts | null {
  const s = parseIso(startDate)
  if (!s) return null
  const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + index)
  const wd = d.getDay()
  return {
    weekdayShort: WEEKDAYS_SHORT[wd]!,
    weekdayLong: WEEKDAYS_LONG[wd]!,
    dayNum: d.getDate(),
    month: MONTHS[d.getMonth()]!,
    monthIndex: d.getMonth(),
    long: `${WEEKDAYS_LONG[wd]}، ${d.getDate()} ${MONTHS[d.getMonth()]}`,
  }
}

/** Index of «today» inside the trip, or null when the trip is not running today. */
export function todayIndex(startDate: string | null | undefined, dayCount: number, now = new Date()): number | null {
  const s = parseIso(startDate)
  if (!s || dayCount <= 0) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((today.getTime() - s.getTime()) / 86400000)
  return diff >= 0 && diff < dayCount ? diff : null
}

export function dayOrdinal(index: number): string {
  return index < ORDINALS.length ? `اليوم ${ORDINALS[index]}` : `اليوم ${index + 1}`
}

export function cityOf(day: PublicItineraryDay, fallback: string): string {
  return day.cityLabel?.trim() || fallback.trim()
}

/** Stable colour per city, by order of first appearance. */
export function buildCityColors(days: PublicItineraryDay[], fallback: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const d of days) {
    const c = cityOf(d, fallback)
    if (c && !map.has(c)) map.set(c, CITY_COLORS[map.size % CITY_COLORS.length]!)
  }
  return map
}

export function placeName(a: PublicItineraryActivity): string {
  return a.place_name?.trim() || a.title?.trim() || 'محطة مميزة'
}

export function formatTime(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(text)
  if (!m) return text
  const hour = Number(m[1])
  if (!Number.isFinite(hour)) return text
  return `${hour % 12 || 12}:${m[2]} ${hour >= 12 ? 'م' : 'ص'}`
}

/**
 * Ground-handling flags read from the existing `flight_details` JSON (no schema change).
 * - private driver: `private_driver: true` or `ground_transport: 'private_driver'`
 * - group trip:     `trip_mode: 'group'` or `is_group: true`
 */
export type GroundInfo = {
  privateDriver: boolean
  group: boolean
  leaderName: string
  meetingPoint: string
  leaderPhone: string
  arrivalNote: string
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}
function truthy(v: unknown): boolean {
  if (v === true) return true
  const s = str(v).toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'نعم'
}

export function readGroundInfo(fd: Record<string, unknown> | null | undefined): GroundInfo {
  const f = fd ?? {}
  const transport = str(f.ground_transport).toLowerCase()
  const mode = str(f.trip_mode).toLowerCase()
  return {
    privateDriver: truthy(f.private_driver) || transport === 'private_driver' || transport === 'سائق خاص',
    group: truthy(f.is_group) || mode === 'group' || mode === 'قروب',
    leaderName: str(f.leader_name),
    meetingPoint: str(f.meeting_point),
    leaderPhone: str(f.leader_phone).replace(/[^\d+]/g, ''),
    arrivalNote: str(f.arrival_note),
  }
}

/** Expert notes of a day: stop notes, de-duplicated, with the stop they belong to. */
export function dayExpertNotes(day: PublicItineraryDay): Array<{ id: string; place: string; note: string }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; place: string; note: string }> = []
  for (const a of day.activities) {
    const n = a.notes?.trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push({ id: a.id, place: placeName(a), note: n })
  }
  return out
}

/* ---------------------------------------------------------------- projection */

export type XY = { x: number; y: number }

/** Fit lat/lng points into a box (equirectangular with latitude correction). */
export function projectPoints(
  pts: Array<{ lat: number; lng: number }>,
  w: number,
  h: number,
  pad: { t: number; r: number; b: number; l: number },
  minSpanDeg = 0.012,
): XY[] {
  if (pts.length === 0) return []
  const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const k = Math.cos((meanLat * Math.PI) / 180)
  const xs = pts.map((p) => p.lng * k)
  const ys = pts.map((p) => -p.lat)
  let minX = Math.min(...xs)
  let maxX = Math.max(...xs)
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, minSpanDeg)
  const spanY = Math.max(maxY - minY, minSpanDeg)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  minX = cx - spanX / 2
  maxX = cx + spanX / 2
  minY = cy - spanY / 2
  maxY = cy + spanY / 2
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const s = Math.min(iw / (maxX - minX), ih / (maxY - minY))
  const ox = pad.l + (iw - (maxX - minX) * s) / 2
  const oy = pad.t + (ih - (maxY - minY) * s) / 2
  return xs.map((x, i) => ({ x: ox + (x - minX) * s, y: oy + (ys[i]! - minY) * s }))
}

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
export function smoothPath(p: XY[]): string {
  if (p.length < 2) return ''
  let d = `M ${p[0]!.x.toFixed(1)} ${p[0]!.y.toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

/** Deterministic pseudo-random (for the decorative contour lines). */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
