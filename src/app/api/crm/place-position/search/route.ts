import { NextResponse, type NextRequest } from 'next/server';

import { kakaoEnabled, kakaoSearch } from '@/lib/place-positions-server';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { resolveCityCenter } from '@/lib/vip-map-coordinates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/crm/place-position/search?q=&city= — staff: Kakao results to pick the right place from. */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!kakaoEnabled()) return NextResponse.json({ ok: false, error: 'no_key' }, { status: 503 });
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const city = (request.nextUrl.searchParams.get('city') ?? '').trim();
  if (!q) return NextResponse.json({ ok: true, results: [] });
  try {
    const near = city ? resolveCityCenter(city, 'korea') : null;
    let results = await kakaoSearch(q, near);
    if (!results.length && near) results = await kakaoSearch(q, null);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.warn('[api/crm/place-position/search]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'search_failed' }, { status: 502 });
  }
}
