import { NextResponse } from 'next/server';

import { saveItineraryClientLinkAction } from '@/app/actions/itineraryClientActions';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const itineraryId = String(id ?? '').trim();
  if (!itineraryId) {
    return NextResponse.json({ ok: false, error: 'missing_itinerary_id' }, { status: 400 });
  }

  let body: { client_id?: string | number | null };
  try {
    body = (await request.json()) as { client_id?: string | number | null };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const result = await saveItineraryClientLinkAction(
    itineraryId,
    body.client_id ?? null,
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
