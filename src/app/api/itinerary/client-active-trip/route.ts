import { NextResponse } from 'next/server';

import { loadClientItinerariesBundleAdmin } from '@/lib/client-itineraries-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  // ننزع بادئات client-/vip- الاصطناعية حتى لا تكسر مطابقة uuid في Postgres
  const clientId = (new URL(request.url).searchParams.get('clientId')?.trim() ?? '')
    .replace(/^(client-|vip-)/i, '');
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'missing_client_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { bundle, error } = await loadClientItinerariesBundleAdmin(admin, clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    trip: bundle.activeTrip,
    pastTrips: bundle.pastTrips,
    allTrips: bundle.allTrips,
  });
}
