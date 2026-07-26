import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Public referral code for a linked client — service-role read
 * (browser RLS often cannot select clients.referral_code).
 *
 * Query: ?client_id=…  and/or  ?trip_id=…
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientIdRaw = (url.searchParams.get('client_id') ?? '').trim();
  const tripIdRaw = (url.searchParams.get('trip_id') ?? '').trim();

  if (!clientIdRaw && !tripIdRaw) {
    return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  let clientId = clientIdRaw;

  if (!clientId && tripIdRaw) {
    const { data: trip, error: tripErr } = await admin
      .from('itineraries')
      .select('client_id')
      .eq('id', tripIdRaw)
      .maybeSingle();

    if (tripErr) {
      return NextResponse.json({ ok: false, error: 'trip_lookup_failed' }, { status: 500 });
    }
    clientId = trip?.client_id != null ? String(trip.client_id).trim() : '';
  }

  if (!clientId) {
    return NextResponse.json({
      ok: true,
      clientId: null,
      referralCode: null,
    });
  }

  const { data: client, error } = await admin
    .from('clients')
    .select('id, referral_code, ref_code')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'client_lookup_failed' }, { status: 500 });
  }

  if (!client) {
    return NextResponse.json({
      ok: true,
      clientId,
      referralCode: null,
    });
  }

  // Match Admin CRM display order: ref_code first, then referral_code
  const referral =
    String(client.ref_code ?? client.referral_code ?? '').trim() || null;

  return NextResponse.json({
    ok: true,
    clientId: client.id,
    referralCode: referral,
  });
}
