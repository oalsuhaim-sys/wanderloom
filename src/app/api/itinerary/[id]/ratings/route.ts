import { NextResponse } from 'next/server';

import { ratingSlot } from '@/lib/stop-ratings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Client stop ratings for one itinerary.
 * GET  → { ratings: { "<day>:<key>": 1..5 } }
 * POST { dayIndex, stopKey, rating, placeName?, bankId? } → saves (one rating per stop per day).
 * Quietly returns nothing until supabase/sql/itinerary_stop_ratings.sql has run.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function db() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  if (!client || !UUID_RE.test(id)) return NextResponse.json({ ratings: {} });
  const { data, error } = await client.from('itinerary_stop_ratings').select('day_index, stop_key, rating').eq('itinerary_id', id);
  if (error) return NextResponse.json({ ratings: {}, ready: false });
  const ratings: Record<string, number> = {};
  for (const r of data ?? []) ratings[ratingSlot(Number(r.day_index), String(r.stop_key))] = Number(r.rating);
  return NextResponse.json({ ratings, ready: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  if (!client || !UUID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const body = (await request.json().catch(() => null)) as {
    dayIndex?: unknown;
    stopKey?: unknown;
    rating?: unknown;
    placeName?: unknown;
    bankId?: unknown;
  } | null;
  const dayIndex = Number(body?.dayIndex);
  const rating = Number(body?.rating);
  const stopKey = String(body?.stopKey ?? '').trim().slice(0, 200);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 120 || !Number.isInteger(rating) || rating < 1 || rating > 5 || !stopKey) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  // the itinerary must exist
  const { data: it } = await client.from('itineraries').select('id').eq('id', id).maybeSingle();
  if (!it) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const bankId = String(body?.bankId ?? '').trim();
  const { error } = await client.from('itinerary_stop_ratings').upsert(
    {
      itinerary_id: id,
      day_index: dayIndex,
      stop_key: stopKey,
      places_bank_id: UUID_RE.test(bankId) ? bankId : null,
      place_name: String(body?.placeName ?? '').trim().slice(0, 200) || null,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'itinerary_id,day_index,stop_key' },
  );
  if (error) {
    console.warn('[api/itinerary/ratings]', error.message);
    return NextResponse.json({ ok: false, error: /relation|schema cache|does not exist/i.test(error.message) ? 'not_ready' : 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
