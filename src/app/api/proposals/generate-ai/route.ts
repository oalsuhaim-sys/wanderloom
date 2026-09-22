import { NextRequest, NextResponse } from 'next/server';

import { generateProposalWithClaude } from '@/lib/ai-generate-proposal-claude';
import type { GenerateProposalAiRequest } from '@/lib/ai-generate-proposal';
import { fetchPlaceCandidates } from '@/lib/dna-place-match';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { coerceClientDbId } from '@/lib/client-onboarding';
import { addDaysIso } from '@/lib/dna-proposal-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseInterestList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text
    .split(/[,،·|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDestinations(raw: unknown, fallback = ''): string[] {
  if (Array.isArray(raw)) {
    return raw.map((d) => String(d ?? '').trim()).filter(Boolean);
  }
  const text = String(raw ?? '').trim() || fallback.trim();
  if (!text) return [];
  return text
    .split(/[·,،|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * POST /api/proposals/generate-ai
 * Claude Sonnet drafts a full proposal JSON from client DNA + trip window.
 * Body: { clientId } OR full GenerateProposalAiRequest fields.
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

  const body = asRecord(rawBody);
  const clientId = coerceClientDbId(body.clientId ?? body.client_id);

  let input: GenerateProposalAiRequest | null = null;

  try {
    if (clientId != null) {
      let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
      try {
        admin = createSupabaseAdminClient();
      } catch {
        admin = null;
      }
      const db = admin ?? (auth.supabase as ReturnType<typeof createSupabaseAdminClient>);

      const { data: clientRow } = await db
        .from('clients')
        .select(
          'id, name, target_trip, hotel_preference, flight_seat, dna_interests, dna_activity_level, dna_special_requests, food_allergies, favorite_drink, travel_dna',
        )
        .eq('id', clientId)
        .maybeSingle();

      const row = (clientRow ?? {}) as Record<string, unknown>;
      const travelDna =
        row.travel_dna && typeof row.travel_dna === 'object' && !Array.isArray(row.travel_dna)
          ? (row.travel_dna as Record<string, unknown>)
          : {};

      const { data: leadRows } = await db
        .from('leads')
        .select(
          'id, destinations, travel_date, travel_days, travelers_count, accommodation_type, interests, created_at',
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8);

      const lead = ((leadRows ?? []) as Record<string, unknown>[])[0] ?? null;
      const destinations = parseDestinations(
        lead?.destinations,
        String(row.target_trip ?? '').trim(),
      );
      const travelDaysRaw = Number(lead?.travel_days);
      const durationDays =
        Number.isFinite(travelDaysRaw) && travelDaysRaw > 0
          ? Math.floor(travelDaysRaw)
          : Math.max(3, destinations.length * 3 || 5);
      const travelDate = String(lead?.travel_date ?? '').trim().slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      const endDate = addDaysIso(travelDate, durationDays - 1);
      const interests = [
        ...parseInterestList(row.dna_interests ?? travelDna.interests),
        ...parseInterestList(lead?.interests),
      ];
      const uniqueInterests = [...new Set(interests)];

      const hotelPref = String(
        row.hotel_preference ?? travelDna.hotel_style ?? lead?.accommodation_type ?? '',
      ).trim();

      const { data: hotels } = await db
        .from('hotels')
        .select('name, city, category')
        .limit(120);

      const placeBuckets = await Promise.all(
        (destinations.length ? destinations : ['']).map((dest) =>
          fetchPlaceCandidates(db, {
            destination: dest,
            interests: uniqueInterests,
            limit: 36,
          }),
        ),
      );
      const seen = new Set<string>();
      const placeCandidates = placeBuckets.flat().filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      const paxRaw = Number(lead?.travelers_count);

      input = {
        clientName: String(row.name ?? '').trim() || 'عميل VIP',
        destinations,
        travelDate,
        endDate,
        durationDays,
        passengersCount:
          Number.isFinite(paxRaw) && paxRaw > 0 ? Math.floor(paxRaw) : null,
        hotelPreference: hotelPref,
        flightSeat: String(row.flight_seat ?? travelDna.preferred_seat ?? '').trim(),
        dnaInterests: uniqueInterests,
        dnaActivityLevel: String(row.dna_activity_level ?? '').trim(),
        dnaSpecialRequests: String(row.dna_special_requests ?? '').trim(),
        foodAllergies: String(row.food_allergies ?? travelDna.food_allergies ?? '').trim(),
        favoriteDrink: String(row.favorite_drink ?? travelDna.drink_coffee ?? '').trim(),
        hotelBankPreview: ((hotels ?? []) as Array<Record<string, unknown>>).map((h) => ({
          name: String(h.name ?? '').trim(),
          city: String(h.city ?? '').trim(),
          category: String(h.category ?? '').trim(),
        })),
        placeCandidates,
      };
    } else {
      const destinations = parseDestinations(
        body.destinations ?? body.destination,
      );
      const durationDays = Math.min(
        14,
        Math.max(1, Math.trunc(Number(body.durationDays ?? body.duration_days ?? body.daysCount) || 1)),
      );
      const travelDate = String(body.travelDate ?? body.travel_date ?? body.tripDateFrom ?? '')
        .trim()
        .slice(0, 10);
      const endDate =
        String(body.endDate ?? body.end_date ?? body.tripDateTo ?? '').trim().slice(0, 10) ||
        (travelDate ? addDaysIso(travelDate, durationDays - 1) : '');

      if (!destinations.length && !String(body.destination ?? '').trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: 'destination_required',
            message: 'الوجهة أو معرّف العميل مطلوب لتوليد العرض.',
          },
          { status: 400 },
        );
      }

      input = {
        clientName: String(body.clientName ?? body.client_name ?? '').trim() || 'عميل VIP',
        destinations: destinations.length
          ? destinations
          : [String(body.destination ?? '').trim()].filter(Boolean),
        travelDate,
        endDate,
        durationDays,
        passengersCount: (() => {
          const n = Number(body.passengersCount ?? body.passengers_count);
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        })(),
        hotelPreference: String(body.hotelPreference ?? body.hotel_preference ?? '').trim(),
        flightSeat: String(body.flightSeat ?? body.flight_seat ?? '').trim(),
        dnaInterests: parseInterestList(body.dnaInterests ?? body.interests),
        dnaActivityLevel: String(body.dnaActivityLevel ?? '').trim(),
        dnaSpecialRequests: String(body.dnaSpecialRequests ?? body.secretNotes ?? '').trim(),
        foodAllergies: String(body.foodAllergies ?? body.dietary ?? '').trim(),
        favoriteDrink: String(body.favoriteDrink ?? '').trim(),
      };
    }
  } catch (err) {
    console.error('[proposals/generate-ai] context build:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'context_failed',
        message: err instanceof Error ? err.message : 'تعذر بناء سياق العميل.',
      },
      { status: 500 },
    );
  }

  if (!input) {
    return NextResponse.json(
      { ok: false, error: 'invalid_input', message: 'مدخلات غير صالحة.' },
      { status: 400 },
    );
  }

  const result = await generateProposalWithClaude(input);
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
    clientId: clientId != null ? String(clientId) : null,
    title: result.payload.titleHint,
    itinerary: result.payload.itinerary,
    recommended_hotels: result.payload.recommendedHotels,
    flight_summary: result.payload.flightSummary,
    daysCount: result.payload.itinerary.length,
    hotelsCount: result.payload.recommendedHotels.length,
    flightsCount: result.payload.flightSummary.length,
    stopCount: result.payload.itinerary.reduce((n, d) => n + (d.stops?.length ?? 0), 0),
  });
}
