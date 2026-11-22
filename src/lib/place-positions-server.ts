import 'server-only';

import { coordsFromRow, coordsFromUrl, mapLinksOf, type LatLng } from '@/lib/place-coords';
import { resolveCityCenter } from '@/lib/vip-map-coordinates';
import { matchBankRows, type BankMatchItem, type BankRow } from '@/lib/places-bank-match-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Exact map positions for itinerary stops, from the places bank:
 *   1. the row's lat / lng, 2. the position inside its map link,
 *   3. a short Google link («maps.app.goo.gl/…») is opened to read the position from where it leads.
 * Positions found in links are written back to the row's lat / lng (when those columns exist) so the
 * next visit is instant.
 */

const SHORT_LINK = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.google\.[a-z.]+\/\?cid=)/i;

/** A pasted map link → its exact position (full links directly, short Google links by following them). */
export async function coordsFromMapLink(url: string): Promise<LatLng | null> {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  return coordsFromUrl(u) ?? (SHORT_LINK.test(u) || /goo\.gl|google\./i.test(u) ? await followShortLink(u) : null);
}

/** Save a confirmed position on the bank row. Throws «columns_missing» until places_coordinates.sql has run. */
export async function savePlacePosition(id: string, c: LatLng): Promise<void> {
  const db = createSupabaseAdminClient();
  const { error } = await db.from('places').update({ lat: c[0], lng: c[1] }).eq('id', id);
  if (error) throw new Error(/column|schema cache/i.test(error.message) ? 'columns_missing' : error.message);
}

// ── Google place search (server key, Places API (New) Text Search) ───────────────

export function googlePlacesEnabled(): boolean {
  return /^AIza[\w-]{20,}$/.test((process.env.GOOGLE_PLACES_SERVER_KEY ?? '').trim());
}

function km(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Google finds the place from its name, branch and city — the same search as Google Maps — biased
 * to 30 km around the city. A result more than 80 km from the city is refused.
 */
async function googleFind(row: BankRow): Promise<LatLng | null> {
  const key = (process.env.GOOGLE_PLACES_SERVER_KEY ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!key || !name) return null;
  const city = String(row.city ?? '').trim();
  const country = String(row.country ?? '').trim();
  const textQuery = [name, String(row.branch_name ?? '').trim(), city, country].filter(Boolean).join(', ');
  const center = city ? resolveCityCenter(city, country || city) : null;
  const body: Record<string, unknown> = { textQuery, pageSize: 1 };
  if (center) body.locationBias = { circle: { center: { latitude: center[0], longitude: center[1] }, radius: 30000 } };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.location' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const json = (await res.json().catch(() => null)) as { places?: Array<{ location?: { latitude?: number; longitude?: number } }> } | null;
  const loc = json?.places?.[0]?.location;
  const c: LatLng | null = loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) ? [loc.latitude!, loc.longitude!] : null;
  if (c && center && km(center, c) > 80) return null;
  return c;
}

/** Rows looked up recently without a result are not searched again for 90 days (keeps it free). */
function recentlyChecked(row: BankRow): boolean {
  const at = Date.parse(String(row.geo_checked_at ?? ''));
  return Number.isFinite(at) && Date.now() - at < 90 * 24 * 60 * 60 * 1000;
}

// ── Kakao Local (free key, Korea) ───────────────────────────────────────────────

export function kakaoEnabled(): boolean {
  return Boolean((process.env.KAKAO_REST_API_KEY ?? '').trim());
}

export type KakaoPlace = { name: string; address: string; category: string; lat: number; lng: number; url: string };

/** Kakao keyword search, optionally around a city centre (20 km). */
export async function kakaoSearch(query: string, near?: LatLng | null): Promise<KakaoPlace[]> {
  const key = (process.env.KAKAO_REST_API_KEY ?? '').trim();
  if (!key || !query.trim()) return [];
  const params = new URLSearchParams({ query: query.trim().slice(0, 100), size: '5', sort: 'accuracy' });
  if (near) {
    params.set('x', String(near[1]));
    params.set('y', String(near[0]));
    params.set('radius', '20000');
  }
  const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  const json = (await res.json().catch(() => null)) as {
    documents?: Array<{ place_name?: string; road_address_name?: string; address_name?: string; category_name?: string; x?: string; y?: string; place_url?: string }>;
  } | null;
  return (json?.documents ?? [])
    .map((d) => ({
      name: String(d.place_name ?? ''),
      address: String(d.road_address_name || d.address_name || ''),
      category: String(d.category_name ?? '').split('>').pop()?.trim() ?? '',
      lat: Number(d.y),
      lng: Number(d.x),
      url: String(d.place_url ?? ''),
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

const norm = (v: string) => v.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');

function isKorea(row: BankRow): boolean {
  return /korea|كوريا|한국/i.test(String(row.country ?? '')) || /seoul|busan|jeju|سيول|بوسان|جيجو/i.test(String(row.city ?? ''));
}

/** Automatic Kakao fill: accepted only when Kakao's name matches the place name exactly. */
async function kakaoExact(row: BankRow): Promise<LatLng | null> {
  const name = String(row.name ?? '').trim();
  if (!name || !isKorea(row)) return null;
  const near = resolveCityCenter(String(row.city ?? ''), 'korea');
  const query = [name, String(row.branch_name ?? '').trim()].filter(Boolean).join(' ');
  const results = await kakaoSearch(query, near).catch(() => []);
  const n = norm(name);
  const hit = results.find((r) => norm(r.name) === n || (n.length >= 4 && norm(r.name) === norm(query)));
  return hit ? [hit.lat, hit.lng] : null;
}

async function followShortLink(url: string): Promise<LatLng | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wanderloom/1.0)' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    }).catch(() => null);
    if (!res) return null;
    const next = res.headers.get('location');
    if (!next) return null;
    const abs = new URL(next, current).toString();
    const c = coordsFromUrl(abs);
    if (c) return c;
    current = abs;
  }
  return null;
}

export async function loadStopPositions(items: BankMatchItem[]): Promise<Record<string, LatLng>> {
  let db;
  try {
    db = createSupabaseAdminClient();
  } catch {
    return {};
  }
  if (!items.length) return {};
  const { byKey } = await matchBankRows(db, items, 'place-positions');

  const out: Record<string, LatLng> = {};
  const byRow = new Map<string, LatLng | null>();
  const toResolve: BankRow[] = [];
  for (const [key, row] of byKey) {
    const id = String(row.id);
    if (!byRow.has(id)) {
      const c = coordsFromRow(row);
      byRow.set(id, c);
      if (!c && mapLinksOf(row).some((u) => SHORT_LINK.test(u))) toResolve.push(row);
    }
    const c = byRow.get(id);
    if (c) out[key] = c;
  }

  // Short Google links: open them (in parallel, bounded) and remember the result on the row
  const batch = toResolve.slice(0, 25);
  const resolved = await Promise.all(
    batch.map(async (row) => {
      const link = mapLinksOf(row).find((u) => SHORT_LINK.test(u))!;
      return [row, await followShortLink(link).catch(() => null)] as const;
    }),
  );
  for (const [row, c] of resolved) {
    if (!c) continue;
    byRow.set(String(row.id), c);
    void savePlacePosition(String(row.id), c).catch(() => undefined);
  }
  const unique = [...new Map([...byKey.values()].map((r) => [String(r.id), r])).values()];

  // Still without a position: Google place search — once per place, saved on the row.
  // Only when the position columns exist (otherwise every visit would search again).
  const columnsReady = unique.some((r) => 'lat' in r && 'geo_checked_at' in r);
  if (googlePlacesEnabled() && columnsReady) {
    const left = unique.filter((r) => !byRow.get(String(r.id)) && !recentlyChecked(r)).slice(0, 30);
    for (let i = 0; i < left.length; i += 5) {
      const found = await Promise.all(
        left.slice(i, i + 5).map(async (r) => {
          try {
            return [r, await googleFind(r), true] as const;
          } catch (err) {
            console.warn('[place-positions] google:', err instanceof Error ? err.message : err);
            return [r, null, false] as const; // API problem: not marked, tried again later
          }
        }),
      );
      for (const [row, c, answered] of found) {
        if (c) {
          byRow.set(String(row.id), c);
          void db.from('places').update({ lat: c[0], lng: c[1], geo_checked_at: new Date().toISOString() }).eq('id', row.id).then(() => undefined);
        } else if (answered) {
          void db.from('places').update({ geo_checked_at: new Date().toISOString() }).eq('id', row.id).then(() => undefined);
        }
      }
    }
  }

  // Korean places still without a position: Kakao, exact name matches only
  if (kakaoEnabled()) {
    const left = unique
      .filter((r) => !byRow.get(String(r.id)) && isKorea(r))
      .slice(0, 20);
    for (let i = 0; i < left.length; i += 5) {
      const found = await Promise.all(left.slice(i, i + 5).map(async (r) => [r, await kakaoExact(r)] as const));
      for (const [row, c] of found) {
        if (!c) continue;
        byRow.set(String(row.id), c);
        void savePlacePosition(String(row.id), c).catch(() => undefined);
      }
    }
  }

  for (const [key, row] of byKey) {
    const c = byRow.get(String(row.id));
    if (c && !out[key]) out[key] = c;
  }
  return out;
}

// ── Bulk: fill positions for the whole places bank (staff button in «بنك الأماكن») ─────

export type GeoBatchResult = {
  processed: number;
  found: { link: number; google: number; kakao: number };
  missed: Array<{ id: string; name: string; city: string }>;
  done: boolean;
};

export async function placesPositionStats(): Promise<{ total: number; withPosition: number } | 'columns_missing'> {
  const db = createSupabaseAdminClient();
  const [all, withPos] = await Promise.all([
    db.from('places').select('id', { count: 'exact', head: true }),
    db.from('places').select('id', { count: 'exact', head: true }).not('lat', 'is', null),
  ]);
  if (withPos.error) return /column|schema cache|does not exist/i.test(withPos.error.message) ? 'columns_missing' : { total: all.count ?? 0, withPosition: 0 };
  return { total: all.count ?? 0, withPosition: withPos.count ?? 0 };
}

/**
 * One batch: places without a position that were not tried since `runStartedAt`.
 * Each is tried once per run: its map link → Google place search → Kakao (Korea, exact name).
 */
export async function geocodeBankBatch(runStartedAt: string, limit = 15): Promise<GeoBatchResult | 'columns_missing'> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('places')
    .select('*')
    .is('lat', null)
    .or(`geo_checked_at.is.null,geo_checked_at.lt."${runStartedAt}"`)
    .order('id', { ascending: true })
    .limit(limit);
  if (error) {
    if (/column|schema cache|does not exist/i.test(error.message)) return 'columns_missing';
    throw new Error(error.message);
  }
  const rows = (data ?? []) as BankRow[];
  const result: GeoBatchResult = { processed: 0, found: { link: 0, google: 0, kakao: 0 }, missed: [], done: rows.length < limit };

  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(async (row) => {
        let c: LatLng | null = coordsFromRow(row);
        let via: keyof GeoBatchResult['found'] | null = c ? 'link' : null;
        if (!c) {
          const short = mapLinksOf(row).find((u) => SHORT_LINK.test(u));
          if (short) {
            c = await followShortLink(short).catch(() => null);
            if (c) via = 'link';
          }
        }
        if (!c && googlePlacesEnabled()) {
          c = await googleFind(row).catch((err) => {
            console.warn('[places-geocode] google:', err instanceof Error ? err.message : err);
            return null;
          });
          if (c) via = 'google';
        }
        if (!c && kakaoEnabled() && isKorea(row)) {
          c = await kakaoExact(row);
          if (c) via = 'kakao';
        }
        const now = new Date().toISOString();
        const { error: saveError } = await db
          .from('places')
          .update(c ? { lat: c[0], lng: c[1], geo_checked_at: now } : { geo_checked_at: now })
          .eq('id', row.id);
        if (saveError) console.warn('[places-geocode] save:', saveError.message);
        result.processed += 1;
        if (c && via) result.found[via] += 1;
        else result.missed.push({ id: String(row.id), name: String(row.name ?? ''), city: String(row.city ?? '') });
      }),
    );
  }
  return result;
}
