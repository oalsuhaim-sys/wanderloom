import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

import {
  buildGenerateItineraryUserPrompt,
  extractJsonObject,
  parseGeneratedItineraryPayload,
  WANDERLOOM_ITINERARY_ENGINEER_SYSTEM,
  type GenerateItineraryRequest,
  type GeneratedItineraryDay,
  type PlaceCandidate,
} from '@/lib/ai-generate-itinerary';
import { fetchPlaceCandidates } from '@/lib/dna-place-match';
import {
  buildStopImageSearchQuery,
  curateStopImage,
  mapWithConcurrency,
} from '@/lib/stop-image-curator';
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

function normalizeBody(raw: unknown): GenerateItineraryRequest {
  const body = asRecord(raw);
  const interestsRaw = body.interests;
  const interests = Array.isArray(interestsRaw)
    ? interestsRaw.map((x) => String(x).trim()).filter(Boolean)
    : String(interestsRaw ?? '')
        .split(/[,،]/)
        .map((x) => x.trim())
        .filter(Boolean);

  const dna = body.dna;
  return {
    destination: String(body.destination ?? body.city ?? '').trim(),
    daysCount: Math.min(14, Math.max(1, Math.trunc(Number(body.daysCount ?? body.days ?? 1) || 1))),
    clientName: String(body.clientName ?? body.client_name ?? '').trim(),
    interests,
    dna: dna && typeof dna === 'object' && !Array.isArray(dna) ? (dna as Record<string, unknown>) : null,
    dietary: String(body.dietary ?? '').trim(),
    hotelPreferences: String(body.hotelPreferences ?? body.hotel_preferences ?? '').trim(),
    secretNotes: String(body.secretNotes ?? body.secret_notes ?? '').trim(),
    tripDateFrom: String(body.tripDateFrom ?? body.trip_date_from ?? '').trim(),
    tripDateTo: String(body.tripDateTo ?? body.trip_date_to ?? '').trim(),
    chatContext: String(body.chatContext ?? body.chat_context ?? body.context ?? '').trim(),
  };
}

async function enrichDaysWithStopImages(
  days: GeneratedItineraryDay[],
  destination: string,
): Promise<{ days: GeneratedItineraryDay[]; imagesAttached: number }> {
  type Job = { dayIndex: number; stopIndex: number };
  const jobs: Job[] = [];
  days.forEach((day, dayIndex) => {
    day.stops.forEach((_stop, stopIndex) => {
      jobs.push({ dayIndex, stopIndex });
    });
  });

  let imagesAttached = 0;

  await mapWithConcurrency(jobs, 3, async (job) => {
    const stop = days[job.dayIndex]?.stops[job.stopIndex];
    if (!stop) return;
    if (stop.image_url?.trim()) return;

    const query = buildStopImageSearchQuery({
      title: stop.title,
      searchKeyword: stop.search_keyword,
      category: stop.category,
      city: days[job.dayIndex]?.city,
      destination,
    });

    const curated = await curateStopImage(query);
    if (curated?.imageUrl) {
      stop.image_url = curated.imageUrl;
      imagesAttached += 1;
    }
  });

  return { days, imagesAttached };
}

/**
 * Bind generated stops to real place rows (Golden Rule): keep only place_ids
 * that exist in the candidate set, attach the hidden real name, and drop any
 * hallucinated id so the client-facing text never leaks an unverified place.
 */
function bindRealPlaces(
  days: GeneratedItineraryDay[],
  candidates: PlaceCandidate[],
): { days: GeneratedItineraryDay[]; placesMatched: number } {
  if (!candidates.length) return { days, placesMatched: 0 };
  const byId = new Map(candidates.map((c) => [String(c.id), c]));
  let placesMatched = 0;
  for (const day of days) {
    for (const stop of day.stops) {
      const id = String(stop.place_id ?? '').trim();
      const match = id ? byId.get(id) : undefined;
      if (match) {
        stop.place_id = match.id;
        stop.place_real_name = match.name;
        placesMatched += 1;
      } else {
        // hallucinated or empty — never persist an unverified reference
        delete stop.place_id;
        delete stop.place_real_name;
      }
    }
  }
  return { days, placesMatched };
}

/**
 * POST /api/admin/generate-itinerary
 * Claude Sonnet generates full multi-day sensory stop plans from client DNA,
 * bound to REAL rows from the `places` bank, then curates luxury images.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const input = normalizeBody(rawBody);
  if (!input.destination) {
    return NextResponse.json(
      { ok: false, error: 'destination_required', message: 'الوجهة مطلوبة لتوليد المسار.' },
      { status: 400 },
    );
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_api_key',
        message: 'مفتاح Anthropic غير متوفر. أضف ANTHROPIC_API_KEY في .env.local / Vercel.',
      },
      { status: 503 },
    );
  }

  const model =
    (process.env.ANTHROPIC_ITINERARY_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-sonnet-4-5';

  // Pull real place candidates from the `places` bank (Golden Rule).
  // Prefer the service-role client; fall back to the request client; never block.
  let candidates: PlaceCandidate[] = [];
  try {
    let placesClient: { from: (t: string) => unknown } | null = null;
    try {
      placesClient = createSupabaseAdminClient();
    } catch {
      placesClient = auth.supabase as unknown as { from: (t: string) => unknown };
    }
    candidates = await fetchPlaceCandidates(placesClient as never, {
      destination: input.destination,
      interests: input.interests ?? [],
      limit: 48,
    });
  } catch (candErr) {
    console.warn('[generate-itinerary] place candidate fetch skipped:', candErr);
  }
  input.placeCandidates = candidates;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0.7,
      system: WANDERLOOM_ITINERARY_ENGINEER_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildGenerateItineraryUserPrompt(input),
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const parsed = extractJsonObject(text);
    let days = parseGeneratedItineraryPayload(parsed);

    // Golden Rule: keep only verified real place refs, attach hidden real names.
    const bound = bindRealPlaces(days, candidates);
    days = bound.days;

    if (!days.length) {
      console.error('[generate-itinerary] empty days. raw slice:', text.slice(0, 400));
      return NextResponse.json(
        {
          ok: false,
          error: 'empty_generation',
          message: 'تعذر تفسير رد Claude — لم تُرجع أيام/محطات صالحة.',
          rawPreview: text.slice(0, 280),
        },
        { status: 502 },
      );
    }

    let imagesAttached = 0;
    try {
      const enriched = await enrichDaysWithStopImages(days, input.destination);
      days = enriched.days;
      imagesAttached = enriched.imagesAttached;
    } catch (imgErr) {
      console.warn('[generate-itinerary] image enrichment skipped:', imgErr);
    }

    return NextResponse.json({
      ok: true,
      model,
      days,
      daysCount: days.length,
      stopCount: days.reduce((n, d) => n + d.stops.length, 0),
      imagesAttached,
      placesMatched: bound.placesMatched,
      placeCandidates: candidates.length,
    });
  } catch (error) {
    console.error('[generate-itinerary] Claude error:', error);
    const detail = error instanceof Error ? error.message : 'claude_request_failed';
    return NextResponse.json(
      {
        ok: false,
        error: 'claude_failed',
        message: `فشل توليد المسار: ${detail}`,
      },
      { status: 500 },
    );
  }
}
