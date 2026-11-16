import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { parseStoredHours, type HoursPeriod, type StoredPlaceHours } from '@/lib/place-hours';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sameCity } from '@/lib/trip-destination-normalize';

/**
 * Opening hours from Google Places (New), cached per bank place in
 * `places.google_place_id / opening_hours / hours_synced_at` (see supabase/sql/places_opening_hours.sql).
 *
 * Cost control: page views only READ the cache. Google is called only for bank rows whose cache is
 * empty or older than 30 days, at most a few per request — so each place costs one lookup a month.
 * Without a Google key or without the columns everything quietly returns nothing.
 */

export type HoursLookupItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inFlight = new Set<string>();

export function googlePlacesKey(): string {
  const k =
    (process.env.GOOGLE_PLACES_API_KEY ?? '').trim() ||
    (process.env.GOOGLE_MAPS_API_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
  return /^AIza[\w-]{20,}$/.test(k) ? k : '';
}

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

async function googleFetch(url: string, init: RequestInit, key: string, fieldMask: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (res.status === 404) return {};
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`google ${res.status}: ${body.slice(0, 160)}`);
  }
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Text Search (IDs only — the free tier) → the Google place id for a bank row. */
async function findGooglePlaceId(row: PlaceRow, key: string): Promise<string | null> {
  const textQuery = [row.name, row.branch_name, row.city, row.country]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (!textQuery) return null;
  const lat = num(row.lat ?? row.latitude);
  const lng = num(row.lng ?? row.longitude);
  const body: Record<string, unknown> = { textQuery, pageSize: 1 };
  if (lat != null && lng != null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 3000 } };
  const json = await googleFetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', body: JSON.stringify(body) }, key, 'places.id');
  const places = Array.isArray(json?.places) ? (json!.places as Array<{ id?: string }>) : [];
  return places[0]?.id?.trim() || null;
}

async function fetchHoursForRow(row: PlaceRow, key: string): Promise<{ googleId: string | null; hours: StoredPlaceHours }> {
  const googleId = String(row.google_place_id ?? '').trim() || (await findGooglePlaceId(row, key));
  if (!googleId) return { googleId: null, hours: { status: 'not_found' } };
  const json = await googleFetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(googleId)}`,
    { method: 'GET' },
    key,
    'regularOpeningHours,businessStatus',
  );
  const roh = (json?.regularOpeningHours ?? null) as { periods?: HoursPeriod[] } | null;
  const businessStatus = typeof json?.businessStatus === 'string' ? json.businessStatus : null;
  const periods = Array.isArray(roh?.periods) ? roh!.periods : [];
  return {
    googleId,
    hours: periods.length ? { status: 'ok', periods, businessStatus } : { status: 'no_hours', businessStatus },
  };
}

/** Refresh hours for stale bank rows (bounded). Safe to run in `after()`. */
export async function syncPlaceHours(rows: PlaceRow[], opts: { max?: number; budgetMs?: number } = {}): Promise<number> {
  const key = googlePlacesKey();
  const db = admin();
  if (!key || !db || !rows.length) return 0;
  const deadline = Date.now() + (opts.budgetMs ?? 25_000);
  const todo = rows.filter((r) => !inFlight.has(String(r.id))).slice(0, opts.max ?? 12);
  todo.forEach((r) => inFlight.add(String(r.id)));
  let done = 0;
  try {
    for (let i = 0; i < todo.length && Date.now() < deadline; i += 3) {
      await Promise.all(
        todo.slice(i, i + 3).map(async (row) => {
          try {
            const { googleId, hours } = await fetchHoursForRow(row, key);
            const { error } = await db
              .from('places')
              .update({ google_place_id: googleId, opening_hours: hours, hours_synced_at: new Date().toISOString() })
              .eq('id', row.id);
            if (error) console.warn('[place-hours] save:', error.message);
            else done += 1;
          } catch (err) {
            // Key / quota problems: leave the row untouched so it is retried later
            console.warn('[place-hours] google:', err instanceof Error ? err.message : err);
          }
        }),
      );
    }
  } finally {
    todo.forEach((r) => inFlight.delete(String(r.id)));
  }
  return done;
}
