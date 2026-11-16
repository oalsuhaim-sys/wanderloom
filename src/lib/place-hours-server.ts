import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { englishPlaceName } from '@/lib/destination-match';
import { parseOsmOpeningHours, parseStoredHours, type StoredPlaceHours } from '@/lib/place-hours';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sameCity } from '@/lib/trip-destination-normalize';

/**
 * Opening hours from OpenStreetMap (free, no key), cached per bank place in
 * `places.opening_hours / hours_synced_at` (see supabase/sql/places_opening_hours.sql).
 * Staff can type hours in the places bank; those (source: manual) are never overwritten.
 *
 * Page views only READ the cache. OpenStreetMap is asked only for bank rows whose cache is empty or
 * older than 30 days, a few per request, one request per second (their fair-use rules).
 * Without the columns everything quietly returns nothing.
 */

export type HoursLookupItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_AGENT = 'Wanderloom/1.0 (+https://wanderloom-travel.vercel.app)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const inFlight = new Set<string>();

function admin(): SupabaseClient | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

type PlaceRow = Record<string, unknown> & { id: string; name?: string; city?: string };

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function needsSync(row: PlaceRow): boolean {
  if (!row.opening_hours) return true;
  if (parseStoredHours(row.opening_hours)?.source === 'manual') return false;
  const at = Date.parse(String(row.hours_synced_at ?? ''));
  return !Number.isFinite(at) || Date.now() - at > REFRESH_MS;
}

/** Read cached hours for the given stops. Returns hours by key + bank rows that should be refreshed. */
export async function loadPlaceHours(items: HoursLookupItem[]): Promise<{
  hours: Record<string, StoredPlaceHours>;
  stale: PlaceRow[];
  enabled: boolean;
}> {
  const db = admin();
  if (!db || !items.length) return { hours: {}, stale: [], enabled: false };

  const ids = [...new Set(items.map((i) => String(i.bankId ?? '').trim()).filter((id) => UUID_RE.test(id) || /^\d+$/.test(id)))];
  const rows: PlaceRow[] = [];
  if (ids.length) {
    const { data, error } = await db.from('places').select('*').in('id', ids.slice(0, 120));
    if (error) {
      console.warn('[place-hours] load by id:', error.message);
    } else rows.push(...((data ?? []) as PlaceRow[]));
  }
  const foundIds = new Set(rows.map((r) => String(r.id)));
  // Stops without a bank id (or with one that no longer exists) are matched by name + city
  const names = [
    ...new Set(
      items
        .filter((i) => !i.bankId || !foundIds.has(String(i.bankId)))
        .map((i) => String(i.name ?? '').trim())
        .filter(Boolean),
    ),
  ];
  if (names.length) {
    const { data, error } = await db.from('places').select('*').in('name', names.slice(0, 120));
    if (error) console.warn('[place-hours] load by name:', error.message);
    else rows.push(...((data ?? []) as PlaceRow[]));
  }
  // Columns not added yet → feature off
  if (rows.length && !rows.some((r) => 'opening_hours' in r)) return { hours: {}, stale: [], enabled: false };

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const hours: Record<string, StoredPlaceHours> = {};
  const used = new Map<string, PlaceRow>();
  for (const item of items) {
    let row = item.bankId ? byId.get(String(item.bankId)) : undefined;
    if (!row && item.name) {
      const name = item.name.trim().toLowerCase();
      const candidates = rows.filter((r) => String(r.name ?? '').trim().toLowerCase() === name);
      row = candidates.find((r) => item.city && sameCity(String(r.city ?? ''), item.city)) ?? (candidates.length === 1 ? candidates[0] : undefined);
    }
    if (!row) continue;
    used.set(String(row.id), row);
    const h = parseStoredHours(row.opening_hours);
    if (h) hours[item.key] = h;
  }
  return { hours, stale: [...used.values()].filter(needsSync), enabled: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Compare names loosely: «N Seoul Tower» ≡ «N서울타워 (N Seoul Tower)». */
function normName(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function nameScore(target: string, tags: Record<string, string>): number {
  const t = normName(target);
  if (t.length < 2) return 0;
  let best = 0;
  for (const k of ['name', 'name:en', 'name:ko', 'name:ja', 'name:zh', 'name:ar', 'int_name', 'official_name', 'brand', 'brand:en', 'alt_name']) {
    const n = normName(tags[k]);
    if (!n) continue;
    if (n === t) return 3;
    if (Math.min(n.length, t.length) >= 4 && (n.includes(t) || t.includes(n))) best = Math.max(best, 2);
  }
  return best;
}

/** Coordinates from the bank row, or from a Google Maps link («@37.55,126.98» / «q=37.55,126.98»). */
function rowCoords(row: PlaceRow): { lat: number; lng: number } | null {
  const lat = num(row.lat ?? row.latitude);
  const lng = num(row.lng ?? row.longitude);
  if (lat != null && lng != null) return { lat, lng };
  const url = String(row.map_url ?? row.maps_url ?? row.google_maps_url ?? '');
  const m = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(url) ?? /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(url);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

type OsmElement = { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } };

/** Nearby OpenStreetMap places that have hours, best name match (nearest wins ties). */
async function overpassNear(name: string, lat: number, lng: number): Promise<OsmElement | null> {
  const query = `[out:json][timeout:12];nwr(around:300,${lat},${lng})["opening_hours"]["name"];out center tags 100;`;
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as { elements?: OsmElement[] } | null;
      const dist = (e: OsmElement) => {
        const la = e.lat ?? e.center?.lat ?? lat;
        const lo = e.lon ?? e.center?.lon ?? lng;
        return (la - lat) ** 2 + (lo - lng) ** 2;
      };
      const scored = (json?.elements ?? [])
        .map((e) => ({ e, score: nameScore(name, e.tags ?? {}) }))
        .filter((x) => x.score >= 2)
        .sort((a, b) => b.score - a.score || dist(a.e) - dist(b.e));
      return scored[0]?.e ?? null;
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}

// Nominatim allows one request per second — keep a single queue per server instance.
let nominatimChain: Promise<unknown> = Promise.resolve();
function nominatimSearch(q: string): Promise<Array<{ extratags?: Record<string, string>; name?: string }>> {
  const run = nominatimChain.then(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&extratags=1&limit=3&accept-language=en&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      return (await res.json().catch(() => [])) as Array<{ extratags?: Record<string, string>; name?: string }>;
    } finally {
      await sleep(1100);
    }
  });
  nominatimChain = run.catch(() => undefined);
  return run;
}

async function fetchHoursForRow(row: PlaceRow): Promise<StoredPlaceHours> {
  const name = String(row.name ?? '').trim();
  if (!name) return { status: 'not_found', source: 'osm' };
  let raw: string | null = null;

  const coords = rowCoords(row);
  if (coords) raw = (await overpassNear(name, coords.lat, coords.lng))?.tags?.opening_hours ?? null;

  if (!raw) {
    const city = String(row.city ?? '').trim();
    const country = String(row.country ?? '').trim();
    const q = [name, String(row.branch_name ?? '').trim(), englishPlaceName(city) ?? city, englishPlaceName(country) ?? country]
      .filter(Boolean)
      .join(', ');
    const results = await nominatimSearch(q);
    if (!results.length) return { status: 'not_found', source: 'osm' };
    raw = results.find((r) => r.extratags?.opening_hours)?.extratags?.opening_hours ?? null;
  }

  const periods = parseOsmOpeningHours(raw);
  return periods ? { status: 'ok', source: 'osm', periods, raw } : { status: 'no_hours', source: 'osm', raw };
}

/** Refresh hours for stale bank rows (bounded). Safe to run in `after()`. */
export async function syncPlaceHours(rows: PlaceRow[], opts: { max?: number; budgetMs?: number } = {}): Promise<number> {
  const db = admin();
  if (!db || !rows.length) return 0;
  const deadline = Date.now() + (opts.budgetMs ?? 25_000);
  const todo = rows.filter((r) => !inFlight.has(String(r.id))).slice(0, opts.max ?? 10);
  todo.forEach((r) => inFlight.add(String(r.id)));
  let done = 0;
  try {
    for (const row of todo) {
      if (Date.now() > deadline) break;
      try {
        const hours = await fetchHoursForRow(row);
        const { error } = await db
          .from('places')
          .update({ opening_hours: hours, hours_synced_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) console.warn('[place-hours] save:', error.message);
        else done += 1;
      } catch (err) {
        // Network / rate-limit problems: leave the row untouched so it is retried later
        console.warn('[place-hours] osm:', err instanceof Error ? err.message : err);
      }
    }
  } finally {
    todo.forEach((r) => inFlight.delete(String(r.id)));
  }
  return done;
}
