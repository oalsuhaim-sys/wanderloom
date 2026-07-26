import { NextResponse } from 'next/server';

import { normalizeProfilePinInput } from '@/lib/client-profile-unlock';
import {
  itineraryPublicSlug,
  lookupClientByProfileCode,
  lookupItineraryByPasscode,
} from '@/lib/vault-unlock-lookup';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type VaultUnlockBody = {
  code?: string | null;
};

export async function POST(request: Request) {
  let body: VaultUnlockBody;
  try {
    body = (await request.json()) as VaultUnlockBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const rawCode = String(body.code ?? '').trim();
  const code = normalizeProfilePinInput(rawCode);
  if (!code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }

  console.log('[vault-unlock] Attempting login with code:', { rawCode, normalized: code });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    console.error('[vault-unlock] Admin client unavailable:', err);
    return NextResponse.json(
      { ok: false, error: 'server_config', debug: { message: 'SUPABASE_SERVICE_ROLE_KEY missing' } },
      { status: 503 },
    );
  }

  const clientLookup = await lookupClientByProfileCode(admin, rawCode);
  console.log('[vault-unlock] Client Check:', clientLookup.debug);

  if (clientLookup.client) {
    const profileCode = clientLookup.client.profile_code;
    console.log('[vault-unlock] Profile match:', clientLookup.client.id);
    return NextResponse.json({
      ok: true,
      kind: 'profile' as const,
      clientId: clientLookup.client.id,
      profileCode,
      redirectTo: `/profile/${encodeURIComponent(profileCode)}`,
    });
  }

  const tripLookup = await lookupItineraryByPasscode(admin, rawCode);
  console.log('[vault-unlock] Trip Check:', tripLookup.debug);

  if (tripLookup.trip) {
    if (String(tripLookup.trip.status ?? '') === 'archived') {
      return NextResponse.json({
        ok: false,
        error: 'itinerary_archived',
        debug: { ...clientLookup.debug, ...tripLookup.debug },
      }, { status: 403 });
    }

    const slug = itineraryPublicSlug(tripLookup.trip);
    if (!slug) {
      return NextResponse.json({
        ok: false,
        error: 'itinerary_not_found',
        debug: { ...clientLookup.debug, ...tripLookup.debug },
      }, { status: 404 });
    }

    console.log('[vault-unlock] Itinerary match:', slug);
    const tripId = String(tripLookup.trip.id ?? '').trim();
    const redirectTo = /^\d+$/.test(tripId)
      ? `/itinerary/${encodeURIComponent(tripId)}?trip_id=${encodeURIComponent(tripId)}`
      : `/itinerary/${encodeURIComponent(slug)}?trip_id=${encodeURIComponent(tripId)}`;

    return NextResponse.json({
      ok: true,
      kind: 'itinerary' as const,
      slug: /^\d+$/.test(tripId) ? tripId : slug,
      tripId,
      redirectTo,
    });
  }

  console.warn('[vault-unlock] No match for code:', code);
  return NextResponse.json({
    ok: false,
    error: 'invalid_code',
    debug: { ...clientLookup.debug, ...tripLookup.debug },
  }, { status: 401 });
}
