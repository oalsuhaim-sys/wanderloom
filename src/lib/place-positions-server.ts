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
  // Korean places still without a position: Kakao, exact name matches only
  if (kakaoEnabled()) {
    const left = [...new Map([...byKey.values()].map((r) => [String(r.id), r])).values()]
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
