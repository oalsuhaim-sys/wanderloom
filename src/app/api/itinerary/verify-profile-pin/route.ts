import { NextResponse } from 'next/server';

import { normalizeProfilePinInput } from '@/lib/client-profile-unlock';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type VerifyBody = {
  clientId?: string | number | null;
  client_id?: string | number | null;
  pin?: string | null;
  itineraryId?: string | number | null;
  itinerary_id?: string | number | null;
  trip_id?: string | number | null;
};

/** Normalize client/trip ids for comparison — never read from URL. */
function normalizeEntityId(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .replace(/^(client-|vip-)/i, '');
}

function idsEqual(a: unknown, b: unknown): boolean {
  const sa = normalizeEntityId(a);
  const sb = normalizeEntityId(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    return Number(sa) === Number(sb);
  }
  return sa.toLowerCase() === sb.toLowerCase();
}

function readClientId(body: VerifyBody): string {
  return normalizeEntityId(body.clientId ?? body.client_id);
}

function readItineraryId(body: VerifyBody): string {
  return normalizeEntityId(body.itineraryId ?? body.itinerary_id ?? body.trip_id);
}

export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const clientId = readClientId(body);
  const pin = normalizeProfilePinInput(String(body.pin ?? ''));

  console.log('[verify-profile-pin] payload:', {
    clientId,
    hasPin: Boolean(pin),
    itineraryId: readItineraryId(body),
  });

  if (!clientId || !pin) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const itineraryId = readItineraryId(body);
  const isSyntheticItineraryId = /^(client-|vip-)/i.test(
    String(body.itineraryId ?? body.itinerary_id ?? body.trip_id ?? ''),
  );

  // Optional cross-check only — PIN authenticity is on clients.profile_code.
  // Do NOT hard-fail on mismatch (fallback Magic Links can have type/coercion noise).
  if (itineraryId && !isSyntheticItineraryId) {
    const itineraryQuery = /^\d+$/.test(itineraryId)
      ? admin.from('itineraries').select('id, client_id').eq('id', Number(itineraryId))
      : admin.from('itineraries').select('id, client_id').eq('magic_link_id', itineraryId);

    const { data: itineraryRow, error: itineraryError } = await itineraryQuery.maybeSingle();
    if (itineraryError) {
      console.warn('[verify-profile-pin] itinerary lookup failed (continuing):', itineraryError.message);
    } else if (itineraryRow?.client_id != null && !idsEqual(itineraryRow.client_id, clientId)) {
      console.warn('[verify-profile-pin] itinerary client_id mismatch (continuing with body clientId):', {
        bodyClientId: clientId,
        itineraryClientId: itineraryRow.client_id,
        itineraryId,
      });
    }
  }

  const clientKey = /^\d+$/.test(clientId) ? Number(clientId) : clientId;
  const { data: clientRow, error: clientError } = await admin
    .from('clients')
    .select('id, profile_code')
    .eq('id', clientKey)
    .maybeSingle();

  if (clientError) {
    console.error('[verify-profile-pin] client lookup failed:', clientError.message);
    return NextResponse.json({ ok: false, error: 'client_lookup_failed' }, { status: 500 });
  }

  if (!clientRow) {
    console.error('[verify-profile-pin] client not found for id:', clientId);
    return NextResponse.json({ ok: false, error: 'client_not_found' }, { status: 404 });
  }

  const storedPin = normalizeProfilePinInput(String(clientRow?.profile_code ?? ''));
  if (!storedPin) {
    return NextResponse.json({ ok: false, error: 'profile_not_configured' }, { status: 404 });
  }

  if (pin !== storedPin) {
    return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    clientId: normalizeEntityId(clientRow.id),
  });
}
