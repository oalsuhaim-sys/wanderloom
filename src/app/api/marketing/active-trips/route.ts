import { NextRequest, NextResponse } from 'next/server';

import { fetchActiveMarketingGroupTrips } from '@/lib/marketing-active-group-trips';
import { siteOrigin } from '@/lib/bank-checkout';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/marketing/active-trips — active group trips with open seats */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    let client;
    try {
      client = createSupabaseAdminClient();
    } catch {
      client = auth.supabase;
    }

    const origin =
      siteOrigin(request.nextUrl.origin) ||
      request.headers.get('origin') ||
      '';

    const trips = await fetchActiveMarketingGroupTrips(client, {
      origin,
      limit: 30,
    });

    return NextResponse.json({
      ok: true,
      trips,
      count: trips.length,
    });
  } catch (err) {
    console.error('[marketing/active-trips]', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'fetch_failed',
        message: err instanceof Error ? err.message : 'تعذر جلب الرحلات.',
      },
      { status: 500 },
    );
  }
}
