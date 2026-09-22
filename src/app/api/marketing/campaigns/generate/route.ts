import { NextRequest, NextResponse } from 'next/server';

import {
  fetchActiveMarketingGroupTrips,
  GROUP_TRIPS_MARKETING_SELECT,
  mapGroupTripToMarketingTrip,
  type MarketingActiveGroupTrip,
} from '@/lib/marketing-active-group-trips';
import { generateMarketingCampaignWithClaude } from '@/lib/marketing-trip-campaigns-claude';
import { normalizeMarketingCampaignMode } from '@/lib/marketing-trip-campaigns';
import { siteOrigin } from '@/lib/bank-checkout';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** POST /api/marketing/campaigns/generate — Claude campaign (brand | private | group) */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = asRecord(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const mode = normalizeMarketingCampaignMode(body.mode ?? body.campaignMode);
  const tripId = String(body.tripId ?? body.trip_id ?? '').trim();
  const origin = siteOrigin(request.nextUrl.origin) || '';

  if (mode === 'group' && !tripId) {
    return NextResponse.json(
      { ok: false, error: 'trip_id_required', message: 'معرّف الرحلة مطلوب لحملات الجروبات.' },
      { status: 400 },
    );
  }

  try {
    let client;
    try {
      client = createSupabaseAdminClient();
    } catch {
      client = auth.supabase;
    }

    let trip: MarketingActiveGroupTrip | null = null;

    if (mode === 'group') {
      const trips = await fetchActiveMarketingGroupTrips(client, { origin, limit: 50 });
      trip = trips.find((t) => t.id === tripId) ?? null;

      if (!trip) {
        const { data } = await client
          .from('group_trips')
          .select(GROUP_TRIPS_MARKETING_SELECT)
          .eq('id', tripId)
          .maybeSingle();

        if (data) {
          const mapped = mapGroupTripToMarketingTrip(data as Record<string, unknown>, origin);
          if (mapped) {
            trip = mapped;
          } else {
            const row = data as Record<string, unknown>;
            const title = String(row.title_ar ?? row.title_en ?? 'رحلة').trim();
            trip = {
              id: tripId,
              title,
              titleEn: String(row.title_en ?? '').trim(),
              destination: String(row.title_en ?? row.title_ar ?? title).trim(),
              datesLabel: String(row.dates_ar ?? row.dates_en ?? '').trim(),
              startDate: null,
              endDate: null,
              price: String(row.price ?? '').trim(),
              highlights: String(row.includes_ar ?? '')
                .split(/[\n•|,،]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 8),
              description: String(row.description_ar ?? '').trim(),
              maxSeats: Number(row.max_seats) || 0,
              bookedSeats: Number(row.booked_seats) || 0,
              openSeats: null,
              bookingUrl: `${origin.replace(/\/$/, '')}/group-onboarding?tripId=${encodeURIComponent(tripId)}`,
              badge: String(row.badge_ar ?? '').trim(),
            };
          }
        }
      }

      if (!trip) {
        return NextResponse.json(
          { ok: false, error: 'trip_not_found', message: 'الرحلة غير موجودة.' },
          { status: 404 },
        );
      }
    }

    const result = await generateMarketingCampaignWithClaude({
      mode,
      trip,
      siteUrl: origin || undefined,
    });

    if (!result.ok) {
      const status = result.error === 'missing_api_key' ? 503 : 502;
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message,
          rawPreview: result.rawPreview,
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      model: result.model,
      mode,
      campaign: result.campaign,
      trip,
    });
  } catch (err) {
    console.error('[marketing/campaigns/generate]', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'generate_failed',
        message: err instanceof Error ? err.message : 'تعذر توليد الحملة.',
      },
      { status: 500 },
    );
  }
}
