import { NextResponse } from 'next/server';

import { mapCelebrityRow } from '@/lib/partner-entities';
import { fetchCelebritiesAdmin } from '@/lib/partner-entities-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { rows, error } = await fetchCelebritiesAdmin(admin);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const platforms = String(body.platforms ?? '').trim();
  const contentFocus = String(body.content_focus ?? body.contentFocus ?? '').trim();
  const profileUrl = String(body.profile_url ?? body.profileUrl ?? '').trim();
  const email = String(body.email ?? '').trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: 'اسم المؤثر مطلوب.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const payload = {
    name,
    phone: phone || null,
    platforms: platforms || null,
    content_focus: contentFocus || null,
    profile_url: profileUrl || null,
    email: email || null,
    status: 'active' as const,
  };

  const { data, error } = await admin
    .from('celebrities')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[crm/celebrities] insert failed:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'insert_failed' },
      { status: 500 },
    );
  }

  const row = mapCelebrityRow((data ?? {}) as Record<string, unknown>);
  return NextResponse.json({ ok: true, row });
}
