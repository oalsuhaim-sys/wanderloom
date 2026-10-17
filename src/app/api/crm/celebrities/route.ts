import { NextResponse } from 'next/server';

import { mapCelebrityRow } from '@/lib/partner-entities';
import { fetchCelebritiesAdmin } from '@/lib/partner-entities-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const INFLUENCERS_TABLE = 'influencers';

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
  const contentType = String(
    body.content_type ?? body.contentType ?? body.content_focus ?? body.contentFocus ?? '',
  ).trim();
  const profileUrl = String(body.profile_url ?? body.profileUrl ?? '').trim();
  const email = String(body.email ?? '').trim();
  const requestedCode = String(
    body.referral_code ?? body.referralCode ?? '',
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const referralCode =
    requestedCode ||
    `WNDR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  if (!name) {
    return NextResponse.json({ ok: false, error: 'اسم المؤثر مطلوب.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  let payload: Record<string, unknown> = {
    name,
    full_name: name,
    phone: phone || null,
    platforms: platforms || null,
    content_type: contentType || null,
    content_focus: contentType || null,
    profile_url: profileUrl || null,
    email: email || null,
    status: 'active',
    referral_code: referralCode,
  };

  let data: Record<string, unknown> | null = null;
  let lastError = '';

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await admin
      .from(INFLUENCERS_TABLE)
      .insert(payload)
      .select('*')
      .single();

    if (!result.error && result.data) {
      data = result.data as Record<string, unknown>;
      break;
    }

    lastError = result.error?.message || 'insert_failed';
    console.warn('[crm/celebrities→influencers] insert retry:', lastError);

    if (/duplicate|unique|23505/i.test(lastError)) {
      return NextResponse.json(
        { ok: false, error: 'كود الإحالة مستخدم مسبقاً. ولّد كوداً آخر.' },
        { status: 409 },
      );
    }

    const missing = lastError.match(/Could not find the '([^']+)' column/i)?.[1]
      ?? lastError.match(/column "([^"]+)"/i)?.[1];
    if (!missing || !(missing in payload)) break;

    const next = { ...payload };
    delete next[missing];
    payload = next;
  }

  if (!data) {
    console.error('[crm/celebrities→influencers] insert failed:', lastError);
    return NextResponse.json(
      { ok: false, error: lastError || 'insert_failed' },
      { status: 500 },
    );
  }

  const row = mapCelebrityRow(data);
  return NextResponse.json({ ok: true, row });
}
