import { NextResponse, type NextRequest } from 'next/server';

import { hasCrmPermission } from '@/lib/crm-permissions';
import { geocodeBankBatch, googlePlacesEnabled, kakaoEnabled, placesPositionStats } from '@/lib/place-positions-server';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function guard(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_itineraries')) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  return null;
}

/** GET — how many bank places have a map position, and which lookups are available. */
export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  const stats = await placesPositionStats().catch(() => null);
  if (stats === 'columns_missing') return NextResponse.json({ ok: false, error: 'columns_missing' });
  return NextResponse.json({ ok: true, ...(stats ?? { total: 0, withPosition: 0 }), google: googlePlacesEnabled(), kakao: kakaoEnabled() });
}

/** POST { runStartedAt } — fill the next batch of places without a position. */
export async function POST(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { runStartedAt?: string } | null;
  const started = Date.parse(String(body?.runStartedAt ?? ''));
  if (!Number.isFinite(started)) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  try {
    const result = await geocodeBankBatch(new Date(started).toISOString());
    if (result === 'columns_missing') return NextResponse.json({ ok: false, error: 'columns_missing' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.warn('[api/crm/places-geocode]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'batch_failed' }, { status: 500 });
  }
}
