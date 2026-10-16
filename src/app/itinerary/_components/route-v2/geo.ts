/**
 * Real-geography support for the route map.
 *
 * Country outlines are pre-built from open data (Natural Earth 1:10m, dataofjapan/land,
 * southkorea-maps) into small JSON files under /public/geo — one per destination,
 * fetched only when a client opens a trip in that country. Coordinates are stored in a
 * flat projection (equirectangular with cos(lat) correction, 1 unit = 0.001°) and
 * delta-encoded, so the browser only turns them into SVG paths once.
 *
 * Anything that goes wrong here (unknown country, offline, bad file) returns null and
 * the map falls back to the stylised view — the page never breaks because of the map.
 */

export type Ring = number[]

export type GeoRegion = {
  en: string
  /** local-script name (東京, 서울 …) when known */
  l?: string | null
  /** label point */
  p: [number, number]
  /** bbox in projected units */
  b: [number, number, number, number]
  r: Ring[]
}

export type GeoPlace = {
  n: string
  x: number
  y: number
  pop: number
  cap: number
  loc?: string
}

export type CountryGeo = {
  id: string
  a3: string
  proj: { lat0: number; lng0: number; u: number; wrap: boolean }
  focus: [number, number, number, number]
  land: Ring[]
  borders: Ring[]
  regions: GeoRegion[]
  neighbors: Ring[]
  rivers: Ring[]
  lakes: Ring[]
  urban: Ring[]
  places: GeoPlace[]
  bbox?: [number, number, number, number]
}

/** Destination bounding boxes (lng0, lat0, lng1, lat1) — used to pick the country file. */
export const GEO_COUNTRIES: Array<{ id: string; bbox: [number, number, number, number] }> = [
  { id: 'japan', bbox: [122.93, 24.04, 146.5, 45.53] },
  { id: 'korea', bbox: [124.61, 33.11, 131.87, 38.61] },
  { id: 'china', bbox: [73.6, 15.78, 134.77, 53.57] },
  { id: 'indonesia', bbox: [95.01, -10.92, 140.98, 5.91] },
  { id: 'canada', bbox: [-141.01, 41.67, -52.62, 70.0] },
  { id: 'south_africa', bbox: [16.47, -34.82, 32.89, -22.13] },
  { id: 'germany', bbox: [5.85, 47.27, 15.02, 55.07] },
  { id: 'spain', bbox: [-18.17, 27.64, 4.34, 43.79] },
  { id: 'italy', bbox: [6.6, 35.49, 18.52, 47.09] },
  { id: 'france', bbox: [-5.13, 41.37, 9.56, 51.09] },
  { id: 'uk', bbox: [-8.62, 49.91, 1.77, 60.85] },
  { id: 'usa', bbox: [-179.14, 18.91, -66.98, 71.41] },
  { id: 'portugal', bbox: [-31.28, 32.49, -6.21, 42.15] },
  { id: 'belgium', bbox: [2.52, 49.5, 6.37, 51.5] },
  { id: 'netherlands', bbox: [3.35, 50.75, 7.2, 53.56] },
  { id: 'czech', bbox: [12.08, 48.56, 18.84, 51.04] },
  { id: 'poland', bbox: [14.12, 48.99, 24.14, 54.84] },
  { id: 'austria', bbox: [9.52, 46.38, 17.15, 49.01] },
  { id: 'sweden', bbox: [11.11, 55.34, 24.16, 69.04] },
  { id: 'russia', bbox: [19.61, 41.19, 191.01, 81.86] },
  { id: 'hungary', bbox: [16.09, 45.74, 22.88, 48.57] },
  { id: 'switzerland', bbox: [5.95, 45.82, 10.47, 47.8] },
  { id: 'uae', bbox: [51.57, 22.62, 56.38, 26.07] },
  { id: 'saudi', bbox: [34.57, 16.37, 55.64, 32.12] },
  { id: 'egypt', bbox: [24.69, 21.99, 36.9, 31.66] },
  { id: 'turkey', bbox: [25.66, 35.82, 44.81, 42.1] },
  { id: 'malaysia', bbox: [99.65, 0.85, 119.28, 7.36] },
  { id: 'thailand', bbox: [97.35, 5.63, 105.65, 20.45] },
  { id: 'georgia', bbox: [39.99, 41.04, 46.69, 43.58] },
  { id: 'azerbaijan', bbox: [44.77, 38.39, 50.63, 41.89] },
  { id: 'morocco', bbox: [-13.2, 27.6, -1.03, 35.93] },
  { id: 'greece', bbox: [19.63, 34.82, 28.24, 41.75] },
  { id: 'maldives', bbox: [72.68, -0.69, 73.75, 7.11] },
]

/** Bump when the files in /public/geo are rebuilt. */
const GEO_VERSION = 1

/** Country names as written in trip destinations — break ties between overlapping boxes. */
const COUNTRY_HINTS: Record<string, RegExp> = {
  japan: /اليابان|japan/i,
  korea: /كوريا|korea/i,
  china: /الصين|china/i,
  indonesia: /اندونيسيا|إندونيسيا|indonesia|بالي|bali/i,
  canada: /كندا|canada/i,
  south_africa: /جنوب\s*[اأ]فريقيا|south africa/i,
  germany: /[اأ]لمانيا|germany/i,
  spain: /[اإ]سبانيا|spain/i,
  italy: /[اإ]يطاليا|italy/i,
  france: /فرنسا|france/i,
  uk: /بريطانيا|[اإ]نجلترا|اسكتلندا|britain|england|scotland|\buk\b/i,
  usa: /[اأ]مريكا|الولايات المتحدة|usa|united states|america/i,
  portugal: /البرتغال|portugal/i,
  belgium: /بلجيكا|belgium/i,
  netherlands: /هولندا|netherlands|holland/i,
  czech: /التشيك|czech/i,
  poland: /بولندا|poland/i,
  austria: /النمسا|austria/i,
  sweden: /السويد|sweden/i,
  russia: /روسيا|russia/i,
  hungary: /المجر|هنغاريا|hungary/i,
  switzerland: /سويسرا|switzerland/i,
  uae: /الامارات|الإمارات|دبي|ابوظبي|أبوظبي|uae|dubai/i,
  saudi: /السعودية|saudi/i,
  egypt: /مصر|egypt/i,
  turkey: /تركيا|turkey|türkiye/i,
  malaysia: /ماليزيا|malaysia/i,
  thailand: /تايلا?ند|thailand/i,
  georgia: /جورجيا|georgia/i,
  azerbaijan: /[اأ]ذربيجان|azerbaijan/i,
  morocco: /المغرب|morocco/i,
  greece: /اليونان|greece/i,
  maldives: /المالديف|maldives/i,
}

/** Pick the destination country from the trip's stop coordinates (majority vote). */
export function detectCountry(points: Array<{ lat: number; lng: number }>, destination = ''): string | null {
  if (points.length === 0) return null
  let best: string | null = null
  let bestCount = 0
  let bestArea = Infinity
  for (const c of GEO_COUNTRIES) {
    const [x0, y0, x1, y1] = c.bbox
    let n = 0
    for (const p of points) {
      const lng = c.id === 'russia' && p.lng < -20 ? p.lng + 360 : p.lng
      if (lng >= x0 && lng <= x1 && p.lat >= y0 && p.lat <= y1) n++
    }
    // the destination's own name settles ties (Fukuoka sits inside Korea's box too)
    const score = n > 0 && COUNTRY_HINTS[c.id]?.test(destination) ? n + 0.5 : n
    const area = (x1 - x0) * (y1 - y0)
    if (score > bestCount || (score === bestCount && score > 0 && area < bestArea)) {
      best = c.id
      bestCount = score
      bestArea = area
    }
  }
  return bestCount >= Math.max(1, Math.ceil(points.length * 0.5)) ? best : null
}

const cache = new Map<string, Promise<CountryGeo | null>>()

function looksValid(g: unknown): g is CountryGeo {
  const o = g as CountryGeo | null
  return Boolean(o && o.proj && Array.isArray(o.land) && o.land.length > 0 && Array.isArray(o.focus))
}

export function loadCountryGeo(id: string): Promise<CountryGeo | null> {
  const hit = cache.get(id)
  if (hit) return hit
  const p = fetch(`/geo/${id}.json?v=${GEO_VERSION}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: unknown) => (looksValid(j) ? j : null))
    .catch(() => null)
  // a failed load may succeed later (e.g. back online)
  void p.then((g) => {
    if (!g) cache.delete(id)
  })
  cache.set(id, p)
  return p
}

export function projectLatLng(geo: CountryGeo, lat: number, lng: number): [number, number] {
  const { lat0, lng0, u, wrap } = geo.proj
  const k = Math.cos((lat0 * Math.PI) / 180)
  const L = wrap && lng < -20 ? lng + 360 : lng
  return [(L - lng0) * k * u, (lat0 - lat) * u]
}

/** Delta-encoded rings → one SVG path string. */
export function ringsToPath(rings: Ring[], closed = true): string {
  let d = ''
  for (const r of rings) {
    if (r.length < 4) continue
    d += `M${r[0]} ${r[1]}l`
    for (let i = 2; i < r.length; i += 2) d += `${r[i]} ${r[i + 1]} `
    if (closed) d += 'z'
  }
  return d
}

/** Absolute points of a delta-encoded ring. */
function decode(r: Ring): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let x = r[0]!
  let y = r[1]!
  out.push([x, y])
  for (let i = 2; i < r.length; i += 2) {
    x += r[i]!
    y += r[i + 1]!
    out.push([x, y])
  }
  return out
}

function inRing(pt: [number, number], ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Index of the region (prefecture / province) containing the point, or -1. */
export function regionAt(geo: CountryGeo, pt: [number, number]): number {
  for (let i = 0; i < geo.regions.length; i++) {
    const g = geo.regions[i]!
    const [x0, y0, x1, y1] = g.b
    if (pt[0] < x0 || pt[0] > x1 || pt[1] < y0 || pt[1] > y1) continue
    // even-odd over all rings handles islands and holes
    let inside = false
    for (const r of g.r) if (inRing(pt, decode(r))) inside = !inside
    if (inside) return i
  }
  return -1
}
