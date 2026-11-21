import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '@/lib/ai-generate-itinerary';
import { englishPlaceName } from '@/lib/destination-match';
import { parseOsmOpeningHours, parseStoredHours, type StoredPlaceHours } from '@/lib/place-hours';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { matchBankRows } from '@/lib/places-bank-match-server';

/**
 * Opening hours read from the web: Claude (the existing ANTHROPIC_API_KEY) searches official sites,
 * Naver / Kakao place pages and tourism sites, and returns the hours with the page it read them from.
 * Cached per bank place in `places.opening_hours / hours_synced_at` (supabase/sql/places_opening_hours.sql).
 * Staff can type hours in the places bank; those (source: manual) are never overwritten.
 *
 * Page views only READ the cache. Lookups run when staff press «ابحث بـ Claude» (itinerary editor or
 * places bank). Optional background lookups (PLACE_HOURS_AUTO=true) cover rows with no hours or hours
 * older than 180 days, a few per request.
 */

export type HoursLookupItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };

const REFRESH_MS = 180 * 24 * 60 * 60 * 1000;
const inFlight = new Set<string>();

export function hoursLookupEnabled(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim()) && process.env.PLACE_HOURS_LOOKUP !== 'false';
}

function hoursModel(): string {
  return (process.env.ANTHROPIC_HOURS_MODEL ?? '').trim() || 'claude-sonnet-5-5';
}

function admin(): SupabaseClient | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

type PlaceRow = Record<string, unknown> & { id: string; name?: string; city?: string };

function needsSync(row: PlaceRow): boolean {
  if (!row.opening_hours) return true;
  if (parseStoredHours(row.opening_hours)?.source === 'manual') return false;
  const at = Date.parse(String(row.hours_synced_at ?? ''));
  return !Number.isFinite(at) || Date.now() - at > REFRESH_MS;
}

/** Read cached hours for the given stops. Returns hours by key + bank rows that should be refreshed. */
export async function loadPlaceHours(items: HoursLookupItem[]): Promise<{
  hours: Record<string, StoredPlaceHours>;
  stale: PlaceRow[];
  enabled: boolean;
}> {
  const db = admin();
  if (!db || !items.length) return { hours: {}, stale: [], enabled: false };

  const { rows, byKey } = await matchBankRows(db, items, 'place-hours');
  // Columns not added yet → feature off
  if (rows.length && !rows.some((r) => 'opening_hours' in r)) return { hours: {}, stale: [], enabled: false };

  const hours: Record<string, StoredPlaceHours> = {};
  const used = new Map<string, PlaceRow>();
  for (const item of items) {
    const row = byKey.get(item.key) as PlaceRow | undefined;
    if (!row) continue;
    used.set(String(row.id), row);
    const h = parseStoredHours(row.opening_hours);
    if (h) hours[item.key] = h;
  }
  return { hours, stale: [...used.values()].filter(needsSync), enabled: true };
}

const SYSTEM = `You find the CURRENT regular opening hours of one place (attraction, restaurant, café, shop) for a travel company.
Search the web. Prefer, in order: the official website, Naver Place / Kakao Map / Google Maps listings, the national tourism site (e.g. VisitKorea, JNTO), then recent reliable listings.
Rules:
- Make sure the page is about THIS place (same name, same city, same branch when a branch is given). If unsure, say not found.
- Answer in OpenStreetMap opening_hours syntax, e.g. "Mo-Fr 10:00-22:00; Sa,Su 09:00-23:00", "Tu-Su 09:00-18:00; Mo off", "24/7", "Mo-Su 11:30-15:00,17:00-22:00", "Fr,Sa 18:00-02:00".
- Regular weekly hours only. Ignore holidays, last-entry times and seasonal exceptions (mention them in "note").
- If the place has permanently closed, set "permanently_closed": true.
- Never guess. If no reliable source states the hours, return found=false.
Output ONLY JSON: {"found":true|false,"opening_hours":"…","permanently_closed":false,"source_url":"https://…","confidence":"high|medium|low","note":"…"}`;

type LookupAnswer = {
  found?: boolean;
  opening_hours?: string;
  permanently_closed?: boolean;
  source_url?: string;
  confidence?: string;
  note?: string;
};

/** Ask Claude (with web search) for one place's hours. Throws on API problems so the row is retried later. */
export async function fetchHoursForRow(row: PlaceRow): Promise<StoredPlaceHours> {
  const name = String(row.name ?? '').trim();
  if (!name) return { status: 'not_found', source: 'web' };
  const city = String(row.city ?? '').trim();
  const country = String(row.country ?? '').trim();
  const lines = [
    `Place: ${name}`,
    String(row.branch_name ?? '').trim() ? `Branch / area: ${String(row.branch_name).trim()}` : '',
    `City: ${city}${englishPlaceName(city) ? ` (${englishPlaceName(city)})` : ''}`,
    country ? `Country: ${country}${englishPlaceName(country) ? ` (${englishPlaceName(country)})` : ''}` : '',
    String(row.sub_tag ?? '').trim() ? `About: ${String(row.sub_tag).trim().slice(0, 160)}` : '',
    String(row.map_url ?? '').trim() ? `Map link: ${String(row.map_url).trim()}` : '',
  ].filter(Boolean);

  const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim() });
  const msg = await client.messages.create(
    {
      model: hoursModel(),
      max_tokens: 1200,
      system: SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: lines.join('\n') }],
    },
    { signal: AbortSignal.timeout(60_000) },
  );
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const ans = (extractJsonObject(text) ?? {}) as LookupAnswer;
  const sourceUrl = typeof ans.source_url === 'string' && /^https?:\/\//.test(ans.source_url) ? ans.source_url.slice(0, 500) : null;

  if (ans.permanently_closed === true && sourceUrl) {
    return { status: 'no_hours', source: 'web', businessStatus: 'CLOSED_PERMANENTLY', sourceUrl };
  }
  if (!ans.found || ans.confidence === 'low' || !sourceUrl) return { status: 'not_found', source: 'web' };
  const raw = String(ans.opening_hours ?? '').trim().slice(0, 300);
  const periods = parseOsmOpeningHours(raw);
  return periods ? { status: 'ok', source: 'web', periods, raw, sourceUrl } : { status: 'no_hours', source: 'web', raw, sourceUrl };
}

/** Look up one bank place now and save it (staff button in the places bank). */
export async function refreshPlaceHoursById(id: string): Promise<StoredPlaceHours | null> {
  const db = admin();
  if (!db || !hoursLookupEnabled()) return null;
  const { data, error } = await db.from('places').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const hours = await fetchHoursForRow(data as PlaceRow);
  const { error: saveError } = await db
    .from('places')
    .update({ opening_hours: hours, hours_synced_at: new Date().toISOString() })
    .eq('id', id);
  if (saveError) throw new Error(saveError.message);
  return hours;
}

/** Save hours typed by staff (or clear them with null). Manual hours are never overwritten by a lookup. */
export async function saveManualPlaceHours(id: string, hours: StoredPlaceHours | null): Promise<void> {
  const db = admin();
  if (!db) throw new Error('unavailable');
  const value = hours ? { ...hours, source: 'manual' as const, sourceUrl: null } : null;
  const { error } = await db
    .from('places')
    .update({ opening_hours: value, hours_synced_at: value ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Background lookups for places opened in itineraries — off unless PLACE_HOURS_AUTO=true (staff use the button). */
export function autoHoursLookupEnabled(): boolean {
  return process.env.PLACE_HOURS_AUTO === 'true' && hoursLookupEnabled();
}

/** Refresh hours for stale bank rows (bounded). Safe to run in `after()`. */
export async function syncPlaceHours(rows: PlaceRow[], opts: { max?: number; budgetMs?: number } = {}): Promise<number> {
  const db = admin();
  if (!db || !rows.length || !hoursLookupEnabled()) return 0;
  const deadline = Date.now() + (opts.budgetMs ?? 50_000);
  const todo = rows.filter((r) => !inFlight.has(String(r.id))).slice(0, opts.max ?? 6);
  todo.forEach((r) => inFlight.add(String(r.id)));
  let done = 0;
  try {
    for (let i = 0; i < todo.length && Date.now() < deadline; i += 3) {
      await Promise.all(
        todo.slice(i, i + 3).map(async (row) => {
          try {
            const hours = await fetchHoursForRow(row);
            const { error } = await db
              .from('places')
              .update({ opening_hours: hours, hours_synced_at: new Date().toISOString() })
              .eq('id', row.id);
            if (error) console.warn('[place-hours] save:', error.message);
            else done += 1;
          } catch (err) {
            // API / network problems: leave the row untouched so it is retried later
            console.warn('[place-hours] lookup:', err instanceof Error ? err.message : err);
          }
        }),
      );
    }
  } finally {
    todo.forEach((r) => inFlight.delete(String(r.id)));
  }
  return done;
}
