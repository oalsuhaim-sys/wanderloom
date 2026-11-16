import { after, NextResponse } from 'next/server';

import { loadPlaceHours, syncPlaceHours, type HoursLookupItem } from '@/lib/place-hours-server';

/**
 * POST { items: [{ key, bankId?, name?, city? }] } → { hours: { [key]: StoredPlaceHours } }
 * Used by the client itinerary page and the CRM itinerary editor. Reads the cache only; places with
 * no / old hours are refreshed from OpenStreetMap after the response (bank rows only, a few per request).
 */
export const maxDuration = 60;

function str(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
    const raw = Array.isArray(body?.items) ? body!.items.slice(0, 80) : [];
    const items: HoursLookupItem[] = raw
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}))
      .map((r) => ({ key: str(r.key, 80), bankId: str(r.bankId, 64) || null, name: str(r.name, 160) || null, city: str(r.city, 80) || null }))
      .filter((i) => i.key && (i.bankId || i.name));

    const { hours, stale, enabled } = await loadPlaceHours(items);
    if (enabled && stale.length) {
      after(async () => {
        await syncPlaceHours(stale, { max: 10, budgetMs: 45_000 });
      });
    }
    return NextResponse.json({ hours, pending: stale.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('[api/place-hours]', err instanceof Error ? err.message : err);
    return NextResponse.json({ hours: {}, pending: 0 });
  }
}
