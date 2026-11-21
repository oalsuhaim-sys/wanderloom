import 'server-only';

import { coordsFromRow, coordsFromUrl, mapLinksOf, type LatLng } from '@/lib/place-coords';
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
    if (!next) {
      // final page: the position is sometimes only in the HTML
      const html = await res.text().catch(() => '');
      return coordsFromUrl(html.slice(0, 200_000));
    }
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
    void db
      .from('places')
      .update({ lat: c[0], lng: c[1] })
      .eq('id', row.id)
      .then(({ error }) => {
        if (error && !/column|schema cache/i.test(error.message)) console.warn('[place-positions] save:', error.message);
      });
  }
  for (const [key, row] of byKey) {
    const c = byRow.get(String(row.id));
    if (c && !out[key]) out[key] = c;
  }
  return out;
}
