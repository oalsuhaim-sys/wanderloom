import { NextResponse } from 'next/server';

import { getTailorDestinations } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/tailor-now/destinations → countries + cities with enough places to build days from. */
export async function GET() {
  try {
    const destinations = await getTailorDestinations();
    return NextResponse.json(
      { ok: true, destinations },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
    );
  } catch (err) {
    console.error('[api/tailor-now/destinations]', err);
    return NextResponse.json({ ok: false, destinations: [] }, { status: 500 });
  }
}
