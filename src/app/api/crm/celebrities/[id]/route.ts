import { NextResponse } from 'next/server';

import {
  parsePartnerDnaProfile,
  serializePartnerDnaProfile,
} from '@/lib/partner-dna';
import { mapCelebrityRow } from '@/lib/partner-entities';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

type RouteContext = { params: Promise<{ id: string }> };

const PRIMARY_TABLE = 'influencers';
const LEGACY_TABLE = 'celebrities';

function isMissingRelation(message: string | undefined): boolean {
  return /relation|table|does not exist|schema cache/i.test(message ?? '');
}

function isMissingColumn(message: string | undefined): boolean {
  return /column|schema cache|does not exist/i.test(message ?? '');
}

async function selectInfluencer(
  admin: SupabaseClient,
  id: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null; table: string }> {
  const primary = await admin.from(PRIMARY_TABLE).select('*').eq('id', id).maybeSingle();
  if (!primary.error) {
    return {
      data: (primary.data as Record<string, unknown> | null) ?? null,
      error: null,
      table: PRIMARY_TABLE,
    };
  }
  if (!isMissingRelation(primary.error.message)) {
    return { data: null, error: primary.error.message, table: PRIMARY_TABLE };
  }

  const legacy = await admin.from(LEGACY_TABLE).select('*').eq('id', id).maybeSingle();
  if (legacy.error) {
    return { data: null, error: legacy.error.message, table: LEGACY_TABLE };
  }
  return {
    data: (legacy.data as Record<string, unknown> | null) ?? null,
    error: null,
    table: LEGACY_TABLE,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const celebrityId = String(id ?? '').trim();
  if (!celebrityId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const result = await selectInfluencer(admin, celebrityId);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    celebrity: mapCelebrityRow(result.data),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const celebrityId = String(id ?? '').trim();
  if (!celebrityId) {
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

  const located = await selectInfluencer(admin, celebrityId);
  if (located.error) {
    return NextResponse.json({ ok: false, error: located.error }, { status: 500 });
  }
  if (!located.data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const table = located.table;
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
  if (body.platforms !== undefined) {
    patch.platforms = String(body.platforms ?? '').trim() || null;
  }
  if (
    body.content_focus !== undefined ||
    body.contentFocus !== undefined ||
    body.content_type !== undefined ||
    body.contentType !== undefined
  ) {
    const content =
      String(
        body.content_type ?? body.contentType ?? body.content_focus ?? body.contentFocus ?? '',
      ).trim() || null;
    patch.content_type = content;
    patch.content_focus = content;
  }
  if (body.profile_url !== undefined || body.profileUrl !== undefined) {
    patch.profile_url =
      String(body.profile_url ?? body.profileUrl ?? '').trim() || null;
  }
  if (body.status !== undefined) {
    patch.status = String(body.status ?? '').trim() || 'active';
  }
  if (body.dna_profile !== undefined || body.dnaProfile !== undefined) {
    patch.dna_profile = serializePartnerDnaProfile(
      parsePartnerDnaProfile(body.dna_profile ?? body.dnaProfile),
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'empty_patch' }, { status: 400 });
  }

  const attempts = [
    patch,
    (() => {
      const p = { ...patch };
      delete p.dna_profile;
      return p;
    })(),
    (() => {
      const p = { ...patch };
      delete p.dna_profile;
      delete p.content_type;
      return p;
    })(),
    (() => {
      const p = { ...patch };
      delete p.dna_profile;
      delete p.content_focus;
      return p;
    })(),
    (() => {
      const p = { ...patch };
      delete p.dna_profile;
      delete p.content_type;
      delete p.content_focus;
      return p;
    })(),
  ].filter((p) => Object.keys(p).length > 0);

  let data: Record<string, unknown> | null = null;
  let lastError = '';

  for (const attempt of attempts) {
    const result = await admin
      .from(table)
      .update(attempt)
      .eq('id', celebrityId)
      .select('*')
      .maybeSingle();

    if (!result.error && result.data) {
      data = result.data as Record<string, unknown>;
      break;
    }
    lastError = result.error?.message || 'update_failed';
    if (!isMissingColumn(lastError)) break;
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: lastError || 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    celebrity: mapCelebrityRow(data),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const celebrityId = String(id ?? '').trim();
  if (!celebrityId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const located = await selectInfluencer(admin, celebrityId);
  if (located.error) {
    return NextResponse.json({ ok: false, error: located.error }, { status: 500 });
  }
  if (!located.data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const { error } = await admin.from(located.table).delete().eq('id', celebrityId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
