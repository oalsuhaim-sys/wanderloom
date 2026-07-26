import { NextResponse } from 'next/server';

import {
  parsePartnerDnaProfile,
  serializePartnerDnaProfile,
} from '@/lib/partner-dna';
import { mapLeaderRow } from '@/lib/partner-entities';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const leaderId = String(id ?? '').trim();
  if (!leaderId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { data, error } = await admin.from('leaders').select('*').eq('id', leaderId).maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    leader: mapLeaderRow(data as Record<string, unknown>),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const leaderId = String(id ?? '').trim();
  if (!leaderId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: 'الاسم مطلوب.' }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = String(body.phone ?? '').trim() || null;
  if (body.email !== undefined) patch.email = String(body.email ?? '').trim() || null;
  if (body.destinations !== undefined) {
    patch.destinations = String(body.destinations ?? '').trim() || null;
  }
  if (body.status !== undefined) {
    patch.status = String(body.status ?? '').trim() || 'active';
  }
  if (body.experience_years !== undefined || body.experienceYears !== undefined) {
    const raw = body.experience_years ?? body.experienceYears;
    const n = Number(raw);
    patch.experience_years = Number.isFinite(n) ? n : null;
  }
  if (body.languages !== undefined) {
    if (Array.isArray(body.languages)) {
      patch.languages = body.languages.map((v) => String(v).trim()).filter(Boolean);
    } else {
      const text = String(body.languages ?? '').trim();
      patch.languages = text
        ? text.split(/[,،]/).map((s) => s.trim()).filter(Boolean)
        : [];
    }
  }
  if (body.dna_profile !== undefined || body.dnaProfile !== undefined) {
    patch.dna_profile = serializePartnerDnaProfile(
      parsePartnerDnaProfile(body.dna_profile ?? body.dnaProfile),
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_patch' }, { status: 400 });
  }

  let { data, error } = await admin
    .from('leaders')
    .update(patch)
    .eq('id', leaderId)
    .select('*')
    .maybeSingle();

  if (error && /dna_profile|column|schema cache|does not exist/i.test(error.message ?? '')) {
    const { dna_profile: _dna, ...withoutDna } = patch;
    if (Object.keys(withoutDna).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'عمود dna_profile غير موجود — نفّذ supabase/sql/partners_dna_profile.sql في Supabase.',
        },
        { status: 500 },
      );
    }
    const retry = await admin
      .from('leaders')
      .update(withoutDna)
      .eq('id', leaderId)
      .select('*')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    leader: mapLeaderRow(data as Record<string, unknown>),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const leaderId = String(id ?? '').trim();
  if (!leaderId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { error } = await admin.from('leaders').delete().eq('id', leaderId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
