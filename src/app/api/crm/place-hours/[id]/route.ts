import { NextResponse, type NextRequest } from 'next/server';

import { refreshPlaceHoursById } from '@/lib/place-hours-server';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** POST /api/crm/place-hours/:id — staff: look up this bank place's opening hours on the web now. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const hours = await refreshPlaceHoursById(String(id ?? '').trim());
    if (!hours) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
    return NextResponse.json({ ok: true, hours });
  } catch (err) {
    console.warn('[api/crm/place-hours]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 502 });
  }
}
