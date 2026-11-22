import { NextResponse } from 'next/server';

import { ratingSlot } from '@/lib/stop-ratings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * The client's opinion of each stop of one itinerary: a 1–5 star rating and/or a short note.
 * GET  → { ratings: { "<day>:<key>": 1..5 }, notes: { "<day>:<key>": "…" } }
 * POST { dayIndex, stopKey, rating?, note?, placeName?, bankId? } → saves what was sent.
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
  if (!client || !UUID_RE.test(id)) return NextResponse.json({ ratings: {}, notes: {} });
  const { data, error } = await client.from('itinerary_stop_ratings').select('*').eq('itinerary_id', id);
  if (error) return NextResponse.json({ ratings: {}, notes: {}, ready: false });
  const ratings: Record<string, number> = {};
  const notes: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ day_index: number; stop_key: string; rating: number | null; note?: string | null }>) {
    const slot = ratingSlot(Number(r.day_index), String(r.stop_key));
    if (r.rating) ratings[slot] = Number(r.rating);
    if (r.note?.trim()) notes[slot] = r.note.trim();
  }
  return NextResponse.json({ ratings, notes, ready: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  if (!client || !UUID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const body = (await request.json().catch(() => null)) as {
    dayIndex?: unknown;
    stopKey?: unknown;
    rating?: unknown;
    note?: unknown;
    placeName?: unknown;
    bankId?: unknown;
  } | null;
  const dayIndex = Number(body?.dayIndex);
  const stopKey = String(body?.stopKey ?? '').trim().slice(0, 200);
  const hasRating = body?.rating != null;
  const rating = Number(body?.rating);
  const hasNote = typeof body?.note === 'string';
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 120 || !stopKey) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if ((!hasRating && !hasNote) || (hasRating && (!Number.isInteger(rating) || rating < 1 || rating > 5))) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  // the itinerary must exist
  const { data: it } = await client.from('itineraries').select('id').eq('id', id).maybeSingle();
  if (!it) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const bankId = String(body?.bankId ?? '').trim();
  const row: Record<string, unknown> = {
    itinerary_id: id,
    day_index: dayIndex,
    stop_key: stopKey,
    places_bank_id: UUID_RE.test(bankId) ? bankId : null,
    place_name: String(body?.placeName ?? '').trim().slice(0, 200) || null,
    updated_at: new Date().toISOString(),
  };
  // only the fields sent are changed (a note does not clear the stars, and the reverse)
  if (hasRating) row.rating = rating;
  if (hasNote) row.note = String(body!.note).trim().slice(0, 1000) || null;

  const { error } = await client.from('itinerary_stop_ratings').upsert(row, { onConflict: 'itinerary_id,day_index,stop_key' });
  if (error) {
    console.warn('[api/itinerary/ratings]', error.message);
    return NextResponse.json({ ok: false, error: /relation|schema cache|does not exist|column/i.test(error.message) ? 'not_ready' : 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
