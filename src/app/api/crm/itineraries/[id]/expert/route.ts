import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminServerAction } from '@/lib/supabase/server-action-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminServerAction();
  if (!auth.ok) {
    return NextResponse.json(auth, { status: 403 });
  }

  const { id } = await context.params;
  const itineraryId = String(id ?? '').trim();
  if (!itineraryId) {
    return NextResponse.json(
      { ok: false, error: 'missing_itinerary_id' },
      { status: 400 },
    );
  }

  let body: { expert_id?: string | number | null };
  try {
    body = (await request.json()) as { expert_id?: string | number | null };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 },
    );
  }

  const expertId = String(body.expert_id ?? '').trim();
  if (!expertId) {
    return NextResponse.json(
      { ok: false, error: 'missing_expert_id' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_config' },
      { status: 503 },
    );
  }

  const expert = await admin
    .from('experts')
    .select('id, status')
    .eq('id', expertId)
    .maybeSingle();
  if (expert.error) {
    return NextResponse.json(
      { ok: false, error: expert.error.message },
      { status: 500 },
    );
  }
  if (!expert.data) {
    return NextResponse.json(
      { ok: false, error: 'expert_not_found' },
      { status: 404 },
    );
  }

  const { data, error } = await admin
    .from('itineraries')
    .update({ expert_id: expertId })
    .eq('id', itineraryId)
    .select('id, expert_id')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'itinerary_not_found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    itineraryId: String(data.id),
    expertId: String(data.expert_id),
  });
}
