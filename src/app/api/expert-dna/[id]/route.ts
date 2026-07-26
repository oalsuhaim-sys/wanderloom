import { NextResponse } from 'next/server';

import {
  parseExpertDnaProfile,
  serializeExpertDnaProfile,
} from '@/lib/expert-dna';
import { mapExpertRow } from '@/lib/partner-entities';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

/** قراءة عامة لبصمة الخبير — بدون مصادقة CRM */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const expertId = String(id ?? '').trim();
  if (!expertId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('experts')
    .select('id, name, specialty_regions, dna_profile')
    .eq('id', expertId)
    .maybeSingle();

  if (error) {
    if (/dna_profile|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const fallback = await admin
        .from('experts')
        .select('id, name, specialty_regions')
        .eq('id', expertId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      const row = mapExpertRow(fallback.data as Record<string, unknown>);
      return NextResponse.json({
        ok: true,
        expert: {
          id: row?.id,
          name: row?.name,
          specialtyRegions: row?.specialtyRegions ?? null,
          dnaProfile: parseExpertDnaProfile({}),
        },
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const row = mapExpertRow(data as Record<string, unknown>);
  return NextResponse.json({
    ok: true,
    expert: {
      id: row?.id,
      name: row?.name,
      specialtyRegions: row?.specialtyRegions ?? null,
      dnaProfile: row?.dnaProfile ?? parseExpertDnaProfile({}),
    },
  });
}

/** تحديث بصمة الخبير من الرابط العام */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const expertId = String(id ?? '').trim();
  if (!expertId) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const routingStyle = String(body.routingStyle ?? body.routing_style ?? '').trim();
  const uniqueAdvantages = String(
    body.uniqueAdvantages ?? body.unique_advantages ?? '',
  ).trim();
  const companyAlignment = String(
    body.companyAlignment ?? body.company_alignment ?? '',
  ).trim();
  const notes = String(body.notes ?? '').trim();

  if (!routingStyle && !uniqueAdvantages && !companyAlignment) {
    return NextResponse.json(
      { ok: false, error: 'يرجى تعبئة حقول بصمة الخبير.' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const dna_profile = serializeExpertDnaProfile(
    { routingStyle, uniqueAdvantages, companyAlignment, notes },
    { markSubmitted: true },
  );

  const { data, error } = await admin
    .from('experts')
    .update({ dna_profile })
    .eq('id', expertId)
    .select('id, name')
    .maybeSingle();

  if (error) {
    if (/dna_profile|column|schema cache|does not exist/i.test(error.message ?? '')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'عمود dna_profile غير موجود بعد. نفّذ supabase/sql/experts_dna_profile.sql في Supabase.',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: 'تم حفظ بصمة الخبير بنجاح.',
  });
}
