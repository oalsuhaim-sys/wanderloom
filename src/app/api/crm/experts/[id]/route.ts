import { NextResponse } from 'next/server';

import { expertMatchesDestination } from '@/lib/expert-itinerary-matching';
import {
  parsePartnerDnaProfile,
  serializePartnerDnaProfile,
} from '@/lib/partner-dna';
import { mapExpertRow } from '@/lib/partner-entities';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

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

  const { data, error } = await admin.from('experts').select('*').eq('id', expertId).maybeSingle();

  if (error) {
    if (/dna_profile|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const fallback = await admin
        .from('experts')
        .select('id, name, specialty_regions, phone, email, status, created_at')
        .eq('id', expertId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        return NextResponse.json(
          { ok: false, error: fallback.error?.message || 'not_found' },
          { status: fallback.error ? 500 : 404 },
        );
      }
      const row = mapExpertRow(fallback.data as Record<string, unknown>);
      return NextResponse.json({
        ok: true,
        expert: row,
        itineraries: [],
        quotations: [],
        matchingGroupTrips: [],
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const expert = mapExpertRow(data as Record<string, unknown>);
  if (!expert) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const { data: itineraryRows } = await admin
    .from('itineraries')
    .select('id, title, destination, status, dates, created_at, client_id')
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false })
    .limit(100);

  const itineraries = (itineraryRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ''),
      title: String(r.title ?? '').trim() || 'مسار بدون عنوان',
      destination: r.destination != null ? String(r.destination) : null,
      status: r.status != null ? String(r.status) : null,
      dates: r.dates != null ? String(r.dates) : null,
      createdAt: r.created_at != null ? String(r.created_at) : null,
    };
  });

  const { data: quotationRows } = await admin
    .from('quotations')
    .select(
      'id, title, destinations, status, start_date, end_date, created_at',
    )
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false })
    .limit(100);

  const quotations = (quotationRows ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id ?? ''),
      title: String(item.title ?? '').trim() || 'عرض سعر بدون عنوان',
      destinations: Array.isArray(item.destinations)
        ? item.destinations.map(String).filter(Boolean)
        : [],
      status: item.status != null ? String(item.status) : null,
      startDate:
        item.start_date != null ? String(item.start_date).slice(0, 10) : null,
      endDate:
        item.end_date != null ? String(item.end_date).slice(0, 10) : null,
    };
  });

  const { data: groupRows } = await admin
    .from('itineraries')
    .select('id, title, destination, status, dates, expert_id')
    .eq('trip_type', 'Group')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);

  const matchingGroupTrips = (groupRows ?? [])
    .filter((row) =>
      expertMatchesDestination(expert, [
        (row as Record<string, unknown>).destination,
      ]),
    )
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id ?? ''),
        title: String(item.title ?? '').trim() || 'رحلة جماعية',
        destination:
          item.destination != null ? String(item.destination) : null,
        dates: item.dates != null ? String(item.dates) : null,
        assignedExpertId:
          item.expert_id != null ? String(item.expert_id) : null,
      };
    });

  return NextResponse.json({
    ok: true,
    expert,
    itineraries,
    quotations,
    matchingGroupTrips,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
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
  if (body.specialty_regions !== undefined || body.specialtyRegions !== undefined) {
    patch.specialty_regions =
      String(body.specialty_regions ?? body.specialtyRegions ?? '').trim() || null;
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

  let { data, error } = await admin
    .from('experts')
    .update(patch)
    .eq('id', expertId)
    .select('*')
    .maybeSingle();

  if (error && /dna_profile|column|schema cache|does not exist/i.test(error.message ?? '')) {
    const withoutDna = { ...patch };
    delete withoutDna.dna_profile;
    if (Object.keys(withoutDna).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'عمود dna_profile غير موجود — نفّذ supabase/sql/experts_dna_profile.sql في Supabase.',
        },
        { status: 500 },
      );
    }
    const retry = await admin
      .from('experts')
      .update(withoutDna)
      .eq('id', expertId)
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
    expert: mapExpertRow(data as Record<string, unknown>),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { error } = await admin.from('experts').delete().eq('id', expertId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
