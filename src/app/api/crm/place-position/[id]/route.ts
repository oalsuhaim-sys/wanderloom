import { NextResponse, type NextRequest } from 'next/server';

import { coordsFromMapLink, savePlacePosition } from '@/lib/place-positions-server';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/crm/place-position/:id — staff: fix a bank place's map position.
 * Body: { url } (a Google Maps / Kakao / Naver link with the position) or { lat, lng } (a picked Kakao result).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { url?: unknown; lat?: unknown; lng?: unknown } | null;

  let c: [number, number] | null = null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) c = [lat, lng];
  else if (typeof body?.url === 'string') c = await coordsFromMapLink(body.url).catch(() => null);
  if (!c) return NextResponse.json({ ok: false, error: 'no_position' }, { status: 400 });

  try {
    await savePlacePosition(String(id ?? '').trim(), c);
    return NextResponse.json({ ok: true, position: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg === 'columns_missing' ? 'columns_missing' : 'save_failed' }, { status: 500 });
  }
}
