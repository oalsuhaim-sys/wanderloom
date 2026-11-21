import { NextResponse } from 'next/server';

import { loadStopPositions } from '@/lib/place-positions-server';
import type { BankMatchItem } from '@/lib/places-bank-match-server';

/**
 * POST { items: [{ key, bankId?, name?, city? }] } → { positions: { [key]: [lat, lng] } }
 * Exact positions of itinerary stops from the places bank (client map view).
 */
export const maxDuration = 30;

function str(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
    const raw = Array.isArray(body?.items) ? body!.items.slice(0, 200) : [];
    const items: BankMatchItem[] = raw
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}))
      .map((r) => ({ key: str(r.key, 80), bankId: str(r.bankId, 64) || null, name: str(r.name, 160) || null, city: str(r.city, 120) || null }))
      .filter((i) => i.key && (i.bankId || i.name));
    const positions = await loadStopPositions(items);
    return NextResponse.json({ positions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('[api/itinerary-positions]', err instanceof Error ? err.message : err);
    return NextResponse.json({ positions: {} });
  }
}
