import { NextResponse } from 'next/server';

import { expertMatchesTripFields } from '@/lib/expert-itinerary-matching';
import {
  parsePartnerDnaProfile,
  serializePartnerDnaProfile,
} from '@/lib/partner-dna';
import { mapExpertRow } from '@/lib/partner-entities';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

type MatchingGroupTripPayload = {
  id: string;
  title: string;
  destination: string | null;
  dates: string | null;
  assignedExpertId: string | null;
  source: 'group_trip' | 'itinerary';
};

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
        .select(
          'id, name, specialty_regions, phone, email, status, created_at, referral_code, commission_rate',
        )
        .eq('id', expertId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        // Columns may be missing on older DBs — retry without commission/referral.
        if (
          fallback.error &&
          /referral_code|commission_rate|column|schema cache|does not exist/i.test(
            fallback.error.message ?? '',
          )
        ) {
          const bare = await admin
            .from('experts')
            .select('id, name, specialty_regions, phone, email, status, created_at')
            .eq('id', expertId)
            .maybeSingle();
          if (bare.error || !bare.data) {
            return NextResponse.json(
              { ok: false, error: bare.error?.message || 'not_found' },
              { status: bare.error ? 500 : 404 },
            );
          }
          const row = mapExpertRow(bare.data as Record<string, unknown>);
          return NextResponse.json({
            ok: true,
            expert: row,
            itineraries: [],
            quotations: [],
            matchingGroupTrips: [],
          });
        }
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

  const matchingGroupTrips: MatchingGroupTripPayload[] = [];
  const seenIds = new Set<string>();

  // Primary source: public.group_trips (CRM / marketing group catalogue)
  const { data: groupTripRows } = await admin
    .from('group_trips')
    .select(
      'id, title_ar, title_en, description_ar, description_en, badge_ar, badge_en, dates_ar, dates_en, is_active',
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(100);

  for (const row of groupTripRows ?? []) {
    const item = row as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    if (!id || seenIds.has(id)) continue;

    const titleAr = String(item.title_ar ?? '').trim();
    const titleEn = String(item.title_en ?? '').trim();
    const matched = expertMatchesTripFields(expert, {
      title: titleAr || titleEn,
      titleAr,
      titleEn,
      descriptionAr: item.description_ar,
      descriptionEn: item.description_en,
      badgeAr: item.badge_ar,
      badgeEn: item.badge_en,
      destination: titleAr || titleEn,
    });
    if (!matched) continue;

    seenIds.add(id);
    matchingGroupTrips.push({
      id,
      title: titleAr || titleEn || 'رحلة جماعية',
      destination: titleAr || titleEn || null,
      dates:
        String(item.dates_ar ?? '').trim() ||
        String(item.dates_en ?? '').trim() ||
        null,
      assignedExpertId: null,
      source: 'group_trip',
    });
  }

  // Secondary: operational itineraries marked as Group (exclude archived/cancelled)
  const { data: groupItineraryRows } = await admin
    .from('itineraries')
    .select('id, title, destination, status, dates, expert_id, trip_type')
    .eq('trip_type', 'Group')
    .order('created_at', { ascending: false })
    .limit(100);

  for (const row of groupItineraryRows ?? []) {
    const item = row as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    if (!id || seenIds.has(id)) continue;

    const status = String(item.status ?? '')
      .trim()
      .toLowerCase();
    if (status === 'archived' || status === 'cancelled' || status === 'canceled') {
      continue;
    }

    const title = String(item.title ?? '').trim();
    const destination =
      item.destination != null ? String(item.destination).trim() : '';
    const matched = expertMatchesTripFields(expert, {
      destination,
      title,
      country: destination,
    });
    if (!matched) continue;

    seenIds.add(id);
    matchingGroupTrips.push({
      id,
      title: title || 'رحلة جماعية',
      destination: destination || null,
      dates: item.dates != null ? String(item.dates) : null,
      assignedExpertId:
        item.expert_id != null ? String(item.expert_id) : null,
      source: 'itinerary',
    });
  }

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
  if (body.referral_code !== undefined || body.referralCode !== undefined) {
    patch.referral_code =
      String(body.referral_code ?? body.referralCode ?? '').trim() || null;
  }
  if (body.commission_rate !== undefined || body.commissionRate !== undefined) {
    const raw = body.commission_rate ?? body.commissionRate;
    const n = Number(raw);
    patch.commission_rate = Number.isFinite(n)
      ? Math.min(100, Math.max(0, n))
      : 15;
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

  if (
    error &&
    /commission_rate|referral_code|column|schema cache|does not exist/i.test(
      error.message ?? '',
    )
  ) {
    const soft = { ...patch };
    if (/commission_rate/i.test(error.message ?? '')) delete soft.commission_rate;
    if (/referral_code/i.test(error.message ?? '')) delete soft.referral_code;
    if (Object.keys(soft).length > 0 && Object.keys(soft).length < Object.keys(patch).length) {
      const retry = await admin
        .from('experts')
        .update(soft)
        .eq('id', expertId)
        .select('*')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
  }

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
