/**
 * DNA → places bank matcher.
 *
 * Pulls REAL rows from the `places` table that fit the client's Travel-DNA
 * interests + trip city, so Claude can bind each itinerary stop to a real
 * place (Golden Rule). No external APIs — Supabase only.
 */

import { DNA_INTEREST_EVENT_TAG_MAP } from '@/lib/client-dna-event-match';
import type { PlaceCandidate } from '@/lib/ai-generate-itinerary';

/** Loose Postgrest chain — avoids deep generic instantiation. */
type PlacesQuery = any;

/** Minimal supabase-like client contract we depend on. */
type SupabaseLike = {
  from: (table: string) => PlacesQuery;
};

const FULL_SELECT = 'id, name, name_en, city, country, category, sub_tag, rating';
const MINIMAL_SELECT = 'id, name, city, country, category';

const FETCH_CAP = 500;
const DEFAULT_LIMIT = 48;

function isMissingColumnError(message: string): boolean {
  return /does not exist|column .* does not exist|could not find/i.test(message);
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Expand raw DNA interests into a flat set of match tokens (Arabic + English). */
export function interestTokens(interests: string[]): string[] {
  const tokens = new Set<string>();
  for (const raw of interests) {
    const key = raw.trim();
    if (!key) continue;
    tokens.add(norm(key));
    const mapped = DNA_INTEREST_EVENT_TAG_MAP[key];
    if (mapped) {
      for (const t of mapped) tokens.add(norm(t));
    } else {
      // partial match against known map keys
      for (const [mapKey, tags] of Object.entries(DNA_INTEREST_EVENT_TAG_MAP)) {
        if (key.includes(mapKey) || mapKey.includes(key)) {
          for (const t of tags) tokens.add(norm(t));
        }
      }
    }
  }
  return [...tokens].filter(Boolean);
}

/** Score a place row by how well it matches the interest tokens. */
function scoreRow(row: Record<string, unknown>, tokens: string[]): number {
  if (!tokens.length) return 0;
  const category = norm(row.category);
  const subTag = norm(row.sub_tag);
  const nameEn = norm(row.name_en);
  const name = norm(row.name);
  let score = 0;
  for (const token of tokens) {
    if (category && (category === token || category.includes(token))) score += 3;
    if (subTag && subTag.includes(token)) score += 2;
    if ((nameEn && nameEn.includes(token)) || (name && name.includes(token))) score += 1;
  }
  return score;
}

function toCandidate(row: Record<string, unknown>): PlaceCandidate {
  const ratingNum = Number(row.rating);
  return {
    id: String(row.id ?? '').trim(),
    name: String(row.name ?? '').trim(),
    name_en: String(row.name_en ?? '').trim() || undefined,
    city: String(row.city ?? '').trim() || undefined,
    category: String(row.category ?? '').trim() || undefined,
    sub_tag: String(row.sub_tag ?? '').trim() || undefined,
    rating: Number.isFinite(ratingNum) ? ratingNum : null,
  };
}

async function runQuery(
  supabase: SupabaseLike,
  select: string,
  destination: string,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const term = destination.replace(/[%,]/g, ' ').trim();
  let q = supabase.from('places').select(select).limit(FETCH_CAP);
  if (term) {
    q = q.or(`city.ilike.%${term}%,country.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) return { rows: [], error: String(error.message ?? error) };
  return { rows: (data ?? []) as Record<string, unknown>[], error: null };
}

/**
 * Fetch real place candidates for a destination, ranked by DNA-interest fit.
 * Returns [] on any failure so itinerary generation degrades gracefully to
 * the existing search_keyword flow.
 */
export async function fetchPlaceCandidates(
  supabase: SupabaseLike | null,
  params: { destination: string; interests: string[]; limit?: number },
): Promise<PlaceCandidate[]> {
  if (!supabase) return [];
  const destination = String(params.destination ?? '').trim();
  const limit = Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT));

  let result = await runQuery(supabase, FULL_SELECT, destination);
  if (result.error && isMissingColumnError(result.error)) {
    // schema without name_en / sub_tag / rating — retry lean
    result = await runQuery(supabase, MINIMAL_SELECT, destination);
  }
  if (result.error) {
    console.warn('[dna-place-match] places query failed:', result.error);
    return [];
  }

  const tokens = interestTokens(params.interests);
  const scored = result.rows
    .map((row) => ({ row, score: scoreRow(row, tokens) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ra = Number(a.row.rating) || 0;
      const rb = Number(b.row.rating) || 0;
      return rb - ra;
    });

  // If interests matched nothing, still return top-rated real places for the city.
  return scored
    .slice(0, limit)
    .map((s) => toCandidate(s.row))
    .filter((c) => c.id && c.name);
}
