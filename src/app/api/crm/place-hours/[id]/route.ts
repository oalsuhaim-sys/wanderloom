import { NextResponse, type NextRequest } from 'next/server';

import { parseStoredHours } from '@/lib/place-hours';
import { refreshPlaceHoursById, saveManualPlaceHours } from '@/lib/place-hours-server';
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

/** PUT /api/crm/place-hours/:id { hours | null } — staff: save hours typed by hand (null clears them). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { hours?: unknown } | null;
  const hours = body?.hours == null ? null : parseStoredHours(body.hours);
  if (body?.hours != null && (!hours || hours.status !== 'ok')) {
    return NextResponse.json({ ok: false, error: 'invalid_hours' }, { status: 400 });
  }
  try {
    await saveManualPlaceHours(String(id ?? '').trim(), hours);
    return NextResponse.json({ ok: true, hours: hours ? { ...hours, source: 'manual' } : null });
  } catch (err) {
    console.warn('[api/crm/place-hours PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 });
  }
}
