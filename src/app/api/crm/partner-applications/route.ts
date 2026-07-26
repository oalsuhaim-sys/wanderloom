import { NextResponse } from 'next/server';

import {
  approvePartnerApplicationAdmin,
  fetchPartnerApplicationsAdmin,
  rejectPartnerApplicationAdmin,
} from '@/lib/partner-applications-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { applications, error } = await fetchPartnerApplicationsAdmin(admin);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, applications });
}

export async function PATCH(request: Request) {
  let body: { id?: number | string; action?: string; review_notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const id = body.id;
  const action = String(body.action ?? '').trim().toLowerCase();
  if (id == null || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const result =
    action === 'approve'
      ? await approvePartnerApplicationAdmin(admin, id, body.review_notes)
      : await rejectPartnerApplicationAdmin(admin, id, body.review_notes);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
