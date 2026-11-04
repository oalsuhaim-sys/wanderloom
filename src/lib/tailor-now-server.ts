import { createHash, randomBytes } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '@/lib/ai-generate-itinerary';
import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { canonicalTripCountryId } from '@/lib/destination-match';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseUrl } from '@/lib/supabase/credentials';
import {
  isTailorLocale,
  tailorCityMaxDays,
  tailorDaySlots,
  tailorDaysTotal,
  tailorRatePerDay,
  tailorTotalPrice,
  TAILOR_CURRENCY,
  TAILOR_FOOD,
  TAILOR_INTERESTS,
  TAILOR_MAX_CITIES,
  TAILOR_MAX_DAYS,
  TAILOR_MIN_CITY_PLACES,
  TAILOR_MIN_DAYS,
  type PublicTailorPlan,
  type TailorAnswers,
  type TailorDay,
  type TailorDaySlot,
  type TailorDestination,
  type TailorLocale,
  type TailorPlanStatus,
  type TailorSegment,
  type TailorStop,
} from '@/lib/tailor-now';

export const TAILOR_TABLE = 'tailor_plans';

/** Opus by owner decision (quality over cost). Override with ANTHROPIC_TAILOR_MODEL. */
export function tailorModel(): string {
  return (process.env.ANTHROPIC_TAILOR_MODEL ?? '').trim() || 'claude-opus-5-5';
}

/** USD per million tokens — Claude Opus 5.5 list prices (platform.claude.com/docs/en/about-claude/pricing). */
const RATES = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

/** Days generated per request (each day is its own Claude call, run in parallel). */
const DAYS_PER_REQUEST = 2;
/** A generation lock older than this is considered abandoned. */
const LOCK_TTL_MS = 3 * 60 * 1000;

export type TailorPlanRow = {
  id: string;
  access_token: string;
  created_at: string;
  locale: string;
  full_name: string;
  phone_wa: string;
  email: string | null;
  country_id: string;
  country_label: string | null;
  segments: unknown;
  start_date: string | null;
  answers: unknown;
  days_total: number;
  price_per_day: number;
  total_price: number;
  currency: string;
  status: string;
  days: unknown;
  receipt_url: string | null;
  receipt_submitted_at: string | null;
  paid_at: string | null;
  lead_id: string | null;
  generation_started_at: string | null;
  ai_model: string | null;
  ai_usage: unknown;
  last_error: string | null;
};

export class TailorError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

function admin(): SupabaseClient {
  return createSupabaseAdminClient();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, max = 500): string {
  return String(v ?? '').trim().slice(0, max);
}

export function hashIp(ip: string | null | undefined): string | null {
  const v = String(ip ?? '').split(',')[0]?.trim();
  if (!v) return null;
  return createHash('sha256').update(`wl-tailor:${v}`).digest('hex').slice(0, 32);
}

// ─────────────────────────────────────────────────────────────── destinations

type PlaceRow = {
  id: string;
  name: string | null;
  name_en: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  sub_tag: string | null;
  rating: number | null;
  tip_ar: string | null;
  map_url: string | null;
  is_active: boolean | null;
};

let destinationsCache: { at: number; data: TailorDestination[] } | null = null;

/** Countries + cities that have enough places in the bank to build days from. */
export async function getTailorDestinations(): Promise<TailorDestination[]> {
  if (destinationsCache && Date.now() - destinationsCache.at < 5 * 60 * 1000) return destinationsCache.data;
  const db = admin();
  const counts = new Map<string, { label: string; cities: Map<string, number> }>();
  const pageSize = 1000;
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const { data, error } = await db
      .from('places')
      .select('country, city, is_active')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ country: string | null; city: string | null; is_active: boolean | null }>;
    for (const row of rows) {
      if (row.is_active === false) continue;
      const country = str(row.country);
      const city = str(row.city);
      if (!country || !city) continue;
      const id = canonicalTripCountryId(country) ?? country;
      const entry = counts.get(id) ?? { label: country, cities: new Map<string, number>() };
      entry.cities.set(city, (entry.cities.get(city) ?? 0) + 1);
      counts.set(id, entry);
    }
    if (rows.length < pageSize) break;
  }
  const data: TailorDestination[] = [...counts.entries()]
    .map(([id, entry]) => ({
      id,
      label: entry.label,
      cities: [...entry.cities.entries()]
        .filter(([, n]) => n >= TAILOR_MIN_CITY_PLACES)
        .sort((a, b) => b[1] - a[1])
        .map(([label, places]) => ({ label, places, maxDays: tailorCityMaxDays(places) })),
    }))
    .filter((d) => d.cities.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  destinationsCache = { at: Date.now(), data };
  return data;
}

// ─────────────────────────────────────────────────────────────── create

export type CreateTailorInput = {
  locale: TailorLocale;
  fullName: string;
  phoneWa: string;
  email: string;
  countryId: string;
  segments: TailorSegment[];
  startDate: string | null;
  answers: TailorAnswers;
};

function pickOne<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = str(value, 40) as T;
  return allowed.includes(v) ? v : fallback;
}

function pickMany(value: unknown, allowed: readonly string[], max = 12): string[] {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((x) => str(x, 40)).filter((x) => allowed.includes(x)))].slice(0, max);
}

export function parseTailorAnswers(raw: unknown): TailorAnswers {
  const a = asRecord(raw);
  const count = Math.trunc(Number(a.travelersCount) || 1);
  return {
    travelers: pickOne(a.travelers, ['solo', 'couple', 'family', 'friends'] as const, 'couple'),
    travelersCount: Math.min(20, Math.max(1, count)),
    pace: pickOne(a.pace, ['calm', 'balanced', 'active'] as const, 'balanced'),
    dayStart: pickOne(a.dayStart, ['early', 'mid', 'late'] as const, 'mid'),
    interests: pickMany(a.interests, TAILOR_INTERESTS),
    food: pickMany(a.food, TAILOR_FOOD),
    lodging: pickOne(a.lodging, ['boutique', 'luxury', 'comfort'] as const, 'luxury'),
    budget: pickOne(a.budget, ['comfort', 'premium', 'unlimited'] as const, 'premium'),
    dream: str(a.dream, 400),
    notes: str(a.notes, 600),
    season: str(a.season, 20) || undefined,
  };
}

async function countRecent(column: 'phone_wa' | 'ip_hash', value: string, sinceIso: string): Promise<number> {
  const { count, error } = await admin()
    .from(TAILOR_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

async function countSince(sinceIso: string): Promise<number> {
  const { count, error } = await admin()
    .from(TAILOR_TABLE)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export function tailorPlanUrl(token: string, origin?: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || origin || '').replace(/\/$/, '');
  return `${base}/tailor-now/${token}`;
}

export async function createTailorPlan(
  input: CreateTailorInput,
  meta: { ipHash: string | null; origin: string },
): Promise<{ token: string }> {
  const destinations = await getTailorDestinations();
  const dest = destinations.find((d) => d.id === input.countryId) ??
    destinations.find((d) => d.id === canonicalTripCountryId(input.countryId));
  if (!dest) throw new TailorError('unknown_destination');

  const seen = new Set<string>();
  const segments: TailorSegment[] = [];
  for (const seg of input.segments.slice(0, TAILOR_MAX_CITIES)) {
    const city = dest.cities.find((c) => c.label === str(seg.city, 120));
    const days = Math.trunc(Number(seg.days) || 0);
    if (!city || days < 1 || seen.has(city.label)) continue;
    seen.add(city.label);
    segments.push({ city: city.label, days: Math.min(days, city.maxDays) });
  }
  const daysTotal = tailorDaysTotal(segments);
  if (!segments.length) throw new TailorError('no_cities');
  if (daysTotal < TAILOR_MIN_DAYS) throw new TailorError('too_few_days');
  if (daysTotal > TAILOR_MAX_DAYS) throw new TailorError('too_many_days');

  const phone = canonicalizePhoneWa(input.phoneWa) || input.phoneWa;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dailyLimit = Math.max(1, Number(process.env.TAILOR_NOW_DAILY_LIMIT) || 200);
  const [byPhone, byIp, total] = await Promise.all([
    countRecent('phone_wa', phone, since),
    meta.ipHash ? countRecent('ip_hash', meta.ipHash, since) : Promise.resolve(0),
    countSince(since),
  ]);
  if (byPhone >= 3 || byIp >= 5) throw new TailorError('rate_limited', 429);
  if (total >= dailyLimit) throw new TailorError('busy', 503);

  const token = randomBytes(18).toString('base64url');
  const rate = tailorRatePerDay(daysTotal);
  const totalPrice = tailorTotalPrice(daysTotal);
  const db = admin();

  const { data: plan, error } = await db
    .from(TAILOR_TABLE)
    .insert({
      access_token: token,
      locale: input.locale,
      full_name: input.fullName,
      phone_wa: phone,
      email: input.email || null,
      country_id: dest.id,
      country_label: dest.label,
      segments,
      start_date: input.startDate,
      answers: input.answers,
      days_total: daysTotal,
      price_per_day: rate,
      total_price: totalPrice,
      currency: TAILOR_CURRENCY,
      status: 'preview',
      ip_hash: meta.ipHash,
      ai_model: tailorModel(),
    })
    .select('id')
    .single();
  if (error || !plan) throw error ?? new Error('insert_failed');

  // Mirror into the CRM pipeline so it shows in the radar like any other request. Never blocks.
  try {
    const route = segments.map((s) => `${s.city} (${s.days})`).join(' ← ');
    const a = input.answers;
    const { data: lead } = await db
      .from('leads')
      .insert({
        full_name: input.fullName,
        phone_wa: phone,
        email: input.email || null,
        destinations: [dest.label],
        travel_date: input.startDate,
        travel_days: String(daysTotal),
        travelers_count: String(a.travelersCount),
        budget: a.budget,
        interests: a.interests,
        travel_style: 'Private',
        daily_pace: a.pace,
        day_start_time: a.dayStart,
        food_preferences: a.food,
        accommodation_type: [a.lodging],
        final_thoughts: `فصّل الآن — ${daysTotal} أيام: ${route} · المبلغ ${totalPrice} ريال · الخطة: ${tailorPlanUrl(token, meta.origin)}${a.dream ? ` · الحلم: ${a.dream}` : ''}${a.notes ? ` · ملاحظات: ${a.notes}` : ''}`,
        form_type: 'tailor_now',
        lead_source: 'website',
        status: 'radar_pending',
      } as never)
      .select('id')
      .single();
    if (lead?.id) await db.from(TAILOR_TABLE).update({ lead_id: lead.id }).eq('id', plan.id);
  } catch (leadErr) {
    console.warn('[tailor-now] lead mirror skipped:', leadErr);
  }

  return { token };
}

// ─────────────────────────────────────────────────────────────── read

export async function loadTailorPlanByToken(token: string): Promise<TailorPlanRow | null> {
  const t = str(token, 64);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return null;
  const { data, error } = await admin().from(TAILOR_TABLE).select('*').eq('access_token', t).maybeSingle();
  if (error) throw error;
  return (data as TailorPlanRow | null) ?? null;
}

export function planSegments(row: TailorPlanRow): TailorSegment[] {
  const list = Array.isArray(row.segments) ? row.segments : [];
  return list
    .map((s) => ({ city: str(asRecord(s).city, 120), days: Math.trunc(Number(asRecord(s).days) || 0) }))
    .filter((s) => s.city && s.days > 0);
}

export function planDays(row: TailorPlanRow): TailorDay[] {
  const list = Array.isArray(row.days) ? (row.days as TailorDay[]) : [];
  return list.filter((d) => d && Number(d.dayNumber) > 0).sort((a, b) => a.dayNumber - b.dayNumber);
}

export function isPlanUnlocked(row: TailorPlanRow): boolean {
  return row.status === 'paid' || row.status === 'ready' || (row.status === 'failed' && Boolean(row.paid_at));
}

function entitledDayNumbers(row: TailorPlanRow): number[] {
  const total = Math.max(1, Math.trunc(row.days_total));
  return isPlanUnlocked(row) ? Array.from({ length: total }, (_, i) => i + 1) : [1];
}

export function toPublicPlan(row: TailorPlanRow): PublicTailorPlan {
  const unlocked = isPlanUnlocked(row);
  const allDays = planDays(row);
  const days = unlocked ? allDays : allDays.filter((d) => d.dayNumber === 1);
  const have = new Set(allDays.map((d) => d.dayNumber));
  const segments = planSegments(row);
  return {
    token: row.access_token,
    locale: isTailorLocale(row.locale) ? row.locale : 'ar',
    firstName: str(row.full_name, 80).split(/\s+/)[0] ?? '',
    countryId: row.country_id,
    countryLabel: row.country_label ?? row.country_id,
    segments,
    startDate: row.start_date,
    daysTotal: row.days_total,
    pricePerDay: Number(row.price_per_day),
    totalPrice: Number(row.total_price),
    currency: row.currency || TAILOR_CURRENCY,
    status: (row.status as TailorPlanStatus) || 'preview',
    unlocked,
    days,
    slots: tailorDaySlots(segments),
    pendingDays: entitledDayNumbers(row).filter((n) => !have.has(n)),
    receiptSubmitted: Boolean(row.receipt_url),
    lastError: row.last_error ? 'generation_failed' : null,
  };
}

// ─────────────────────────────────────────────────────────────── generation

/** Wanderloom Standard daily rhythm — the same 8 beats the expert itinerary builder uses. */
const BEATS = [
  { ar: 'الصحوة', en: 'Morning', cat: ['h'] },
  { ar: 'الإفطار', en: 'Breakfast', cat: ['r', 'c'] },
  { ar: 'الشارع المميز', en: 'Signature street', cat: ['s', 'o'] },
  { ar: 'القهوة المختصة', en: 'Specialty coffee', cat: ['c'] },
  { ar: 'المعلم الأساسي', en: 'Highlight', cat: ['l'] },
  { ar: 'تجربة خاصة', en: 'Private experience', cat: ['d', 'f', 'o'] },
  { ar: 'المنطقة الليلية', en: 'Evening district', cat: ['s', 'o', 'l'] },
  { ar: 'العشاء', en: 'Dinner', cat: ['r'] },
] as const;

const SYSTEM_PROMPT = `You are the planning engine behind «فصّل الآن» (Tailor Now) by Wanderloom, a Saudi bespoke-travel house whose motto is «واندرلوم: تفصيل لا تنظيم».
You build ONE day of a private, day-by-day travel plan for Gulf travelers who will follow it on their own.

Every day follows the Wanderloom Standard rhythm — exactly these 8 stops, in this order:
1. الصحوة (Morning) — a calm start near the hotel area: a morning ritual, view, garden or quiet walk.
2. الإفطار (Breakfast) — a specific, local breakfast spot.
3. الشارع المميز (Signature street) — a distinctive street, quarter or boutique walk.
4. القهوة المختصة (Specialty coffee) — a specialty coffee stop.
5. المعلم الأساسي (Highlight) — the day's main landmark, at the quietest sensible time.
6. تجربة خاصة (Private experience) — an immersive experience, workshop, view or activity.
7. المنطقة الليلية (Evening district) — an elegant evening area to stroll.
8. العشاء (Dinner) — a dinner close.

Rules:
- Output ONLY valid JSON (no markdown, no commentary) in the shape requested.
- Pick each stop from the provided "Places" list whenever one fits the beat, and copy its id EXACTLY into "place_id". Never invent an id. If nothing fits, set "place_id" to "" and describe a generic but concrete activity (e.g. a riverside walk) in the title.
- Never use the same place twice in a day. Never use a place from the "Already used" list.
- Keep the day geographically sensible: neighbouring areas, little back-and-forth.
- Times are HH:MM (24h), realistic, spaced for the traveler's pace and preferred start time.
- "title": short and evocative (max ~8 words). "notes": 1–2 sentences: why it suits this traveler + one practical tip (best time, what to order, booking ahead). No prices, no opening-hour promises.
- Respect food needs. If the traveler eats halal, favour seafood/vegetarian-friendly or halal options for meals and add a short "confirm halal" tip on meat-based restaurants.
- Families: keep it child-friendly. Calm pace: fewer transitions, longer moments.
- Travel day between cities: start with the journey (keep morning beats light and near the station/arrival area).
- Last day of the trip: keep the evening light.
- Voice: warm, refined, specific. Do not mention artificial intelligence, models, algorithms, or that a person/expert wrote the plan. Do not use the words «باقة», «عرض», «خصم», «تنظيم رحلات».`;

type Candidate = { id: string; label: string; category: string; tag: string; tip: string; mapsUrl: string; name: string };

const INTEREST_HINTS: Record<string, string[]> = {
  culture: ['museum', 'temple', 'palace', 'history', 'متحف', 'معبد', 'قصر', 'تاريخ', 'heritage'],
  nature: ['park', 'garden', 'beach', 'mountain', 'lake', 'حديقة', 'شاطئ', 'جبل', 'بحيرة', 'nature'],
  food: ['market', 'food', 'سوق', 'restaurant'],
  coffee: ['coffee', 'cafe', 'roaster', 'قهوة'],
  shopping: ['mall', 'shop', 'boutique', 'store', 'تسوق', 'outlet'],
  art: ['gallery', 'art', 'design', 'فن', 'معرض'],
  photo: ['view', 'tower', 'observatory', 'إطلالة', 'برج'],
  adventure: ['tour', 'cruise', 'ski', 'experience', 'مغامرة'],
  wellness: ['spa', 'onsen', 'hammam', 'wellness', 'سبا'],
  family: ['zoo', 'aquarium', 'theme', 'kids', 'disney', 'عائلي'],
  nightlife: ['night', 'rooftop', 'ليل'],
  pop: ['bts', 'kpop', 'anime', 'k-drama', 'ghibli', 'pokemon'],
};

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function fetchCityPool(row: TailorPlanRow, city: string): Promise<Candidate[]> {
  const { data, error } = await admin()
    .from('places')
    .select('id, name, name_en, country, city, category, sub_tag, rating, tip_ar, map_url, is_active')
    .eq('city', city)
    .limit(3000);
  if (error) throw error;
  const rows = ((data ?? []) as PlaceRow[]).filter(
    (p) =>
      p.is_active !== false &&
      str(p.name) &&
      (canonicalTripCountryId(p.country ?? '') ?? str(p.country)) === row.country_id,
  );
  return rows.map((p) => {
    const name = str(p.name, 160);
    const en = str(p.name_en, 160);
    const q = [name, p.city, p.country].filter(Boolean).join(' ');
    return {
      id: p.id,
      name,
      label: en && en !== name ? `${name} / ${en}` : name,
      category: str(p.category, 4) || 'o',
      tag: str(p.sub_tag, 60),
      tip: str(p.tip_ar, 160),
      mapsUrl: str(p.map_url) || `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
    };
  });
}

/** Per-day shortlist: balanced across categories, ranked by interest fit, disjoint between days. */
function pickCandidates(pool: Candidate[], answers: TailorAnswers, exclude: Set<string>): Candidate[] {
  const hints = answers.interests.flatMap((k) => INTEREST_HINTS[k] ?? []);
  const score = (c: Candidate) => {
    const hay = `${c.label} ${c.tag} ${c.tip}`.toLowerCase();
    return hints.reduce((n, h) => (hay.includes(h.toLowerCase()) ? n + 2 : n), 0) + (c.tip ? 1 : 0);
  };
  const quotas: Record<string, number> = {
    h: 3, r: 9, c: 6, s: 6, l: 8, d: 6, f: answers.travelers === 'family' ? 5 : 2, o: 8,
  };
  const picked: Candidate[] = [];
  const byCat = new Map<string, Candidate[]>();
  for (const c of shuffle(pool)) {
    if (exclude.has(c.id)) continue;
    const list = byCat.get(c.category) ?? [];
    list.push(c);
    byCat.set(c.category, list);
  }
  for (const [cat, quota] of Object.entries(quotas)) {
    const list = (byCat.get(cat) ?? []).sort((a, b) => score(b) - score(a));
    picked.push(...list.slice(0, quota));
  }
  // top up from whatever is left if a category was thin
  if (picked.length < 36) {
    const have = new Set(picked.map((c) => c.id));
    const rest = shuffle(pool.filter((c) => !exclude.has(c.id) && !have.has(c.id)));
    picked.push(...rest.slice(0, 36 - picked.length));
  }
  return picked;
}

const LABELS: Record<string, Record<string, string>> = {
  travelers: { solo: 'solo traveler', couple: 'couple', family: 'family with children', friends: 'group of friends' },
  pace: { calm: 'calm — fewer stops, long unhurried moments', balanced: 'balanced', active: 'active — happy to walk and see more' },
  dayStart: { early: 'early riser (~07:30)', mid: 'mid-morning start (~09:00)', late: 'late start (~10:30)' },
  lodging: { boutique: 'boutique hotel', luxury: '5-star luxury hotel', comfort: 'comfortable 4-star' },
  budget: { comfort: 'comfortable', premium: 'premium', unlimited: 'no real ceiling' },
};

function buildDayPrompt(row: TailorPlanRow, slot: TailorDaySlot, candidates: Candidate[], used: string[]): string {
  const a = parseTailorAnswers(row.answers);
  const locale = isTailorLocale(row.locale) ? row.locale : 'ar';
  const route = planSegments(row).map((s) => `${s.city} (${s.days} days)`).join(' → ');
  const date = row.start_date
    ? new Date(new Date(`${row.start_date}T00:00:00Z`).getTime() + (slot.dayNumber - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10)
    : null;
  return [
    `Write the plan in ${locale === 'en' ? 'English' : 'Arabic (elegant Modern Standard Arabic that reads naturally to Saudis)'}.`,
    '',
    `Country: ${row.country_label ?? row.country_id}`,
    `Full route: ${route}`,
    `This is day ${slot.dayNumber} of ${row.days_total} — in ${slot.city}, day ${slot.dayInCity} of ${slot.cityDays} there.`,
    slot.isFirstDay ? 'Arrival day of the whole trip: ease in.' : '',
    slot.isTransfer ? 'Travel day: the traveler arrives in this city from the previous one this morning.' : '',
    slot.isLastDay ? 'Final day of the trip.' : '',
    date ? `Date: ${date}` : a.season ? `Season: ${a.season}` : '',
    '',
    `Traveler: ${LABELS.travelers[a.travelers]}, ${a.travelersCount} person(s)`,
    `Pace: ${LABELS.pace[a.pace]}`,
    `Day start: ${LABELS.dayStart[a.dayStart]}`,
    `Interests: ${a.interests.join(', ') || 'open to anything'}`,
    `Food: ${a.food.join(', ') || 'no restrictions'}`,
    `Hotel style: ${LABELS.lodging[a.lodging]} · Budget feel: ${LABELS.budget[a.budget]}`,
    a.dream ? `What they want to feel by the end of the trip: ${a.dream}` : '',
    a.notes ? `Notes from the traveler: ${a.notes}` : '',
    '',
    `Already used on other days (do not reuse): ${used.length ? used.join(', ') : 'none'}`,
    '',
    'Places (id | name | category | tag | note):',
    ...candidates.map((c) => `- ${c.id} | ${c.label} | ${c.category}${c.tag ? ` | ${c.tag}` : ''}${c.tip ? ` | ${c.tip}` : ''}`),
    '',
    'Category codes: h hotel, r restaurant, c cafe, s shopping/street, l landmark, d experience, f family, o other.',
    'Return ONLY:',
    '{"title":"day title (max ~6 words)","summary":"one sentence on the feel of the day","stops":[{"beat":1,"time":"HH:MM","title":"…","notes":"…","place_id":"exact id or empty"}]}',
    'with exactly 8 stops, beats 1→8 in order.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

type Usage = {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd: number;
};

function addUsage(base: unknown, u: Anthropic.Usage | null | undefined): Usage {
  const b = asRecord(base);
  const inp = u?.input_tokens ?? 0;
  const out = u?.output_tokens ?? 0;
  const cr = u?.cache_read_input_tokens ?? 0;
  const cw = u?.cache_creation_input_tokens ?? 0;
  const cost = (inp * RATES.input + out * RATES.output + cr * RATES.cacheRead + cw * RATES.cacheWrite) / 1_000_000;
  return {
    calls: (Number(b.calls) || 0) + 1,
    input_tokens: (Number(b.input_tokens) || 0) + inp,
    output_tokens: (Number(b.output_tokens) || 0) + out,
    cache_read_input_tokens: (Number(b.cache_read_input_tokens) || 0) + cr,
    cache_creation_input_tokens: (Number(b.cache_creation_input_tokens) || 0) + cw,
    cost_usd: Math.round(((Number(b.cost_usd) || 0) + cost) * 10000) / 10000,
  };
}

function normTime(raw: unknown, fallback: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(str(raw, 8));
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : fallback;
}

const FALLBACK_TIMES = ['08:00', '09:00', '10:30', '12:00', '13:30', '16:00', '19:00', '20:30'];

export function parseDayResponse(
  text: string,
  slot: TailorDaySlot,
  candidates: Candidate[],
  locale: TailorLocale,
): TailorDay | null {
  const root = asRecord(extractJsonObject(text));
  const dayRoot = Array.isArray(root.days) ? asRecord(root.days[0]) : root;
  const stopsRaw = Array.isArray(dayRoot.stops) ? dayRoot.stops : [];
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const usedInDay = new Set<string>();
  const stops: TailorStop[] = [];
  stopsRaw.slice(0, 8).forEach((raw, i) => {
    const s = asRecord(raw);
    const title = str(s.title, 160);
    if (!title) return;
    const beatIndex = Math.min(7, Math.max(0, (Math.trunc(Number(s.beat)) || i + 1) - 1));
    const beat = BEATS[beatIndex]!;
    const id = str(s.place_id, 64);
    const place = id && !usedInDay.has(id) ? byId.get(id) : undefined;
    if (place) usedInDay.add(place.id);
    stops.push({
      beat: locale === 'en' ? beat.en : beat.ar,
      time: normTime(s.time, FALLBACK_TIMES[beatIndex]!),
      title,
      notes: str(s.notes, 600),
      category: place?.category ?? beat.cat[0],
      ...(place ? { placeId: place.id, placeName: place.name, mapsUrl: place.mapsUrl } : {}),
    });
  });
  if (stops.length < 5) return null;
  return {
    dayNumber: slot.dayNumber,
    city: slot.city,
    title: str(dayRoot.title, 120) || (locale === 'en' ? `Day ${slot.dayNumber}` : `اليوم ${slot.dayNumber}`),
    summary: str(dayRoot.summary, 300),
    stops,
  };
}

async function generateOneDay(
  client: Anthropic,
  row: TailorPlanRow,
  slot: TailorDaySlot,
  candidates: Candidate[],
  used: string[],
): Promise<{ day: TailorDay | null; usage: Anthropic.Usage | null; error?: string }> {
  const locale = isTailorLocale(row.locale) ? row.locale : 'ar';
  try {
    const message = await client.messages.create({
      model: row.ai_model || tailorModel(),
      max_tokens: 6000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildDayPrompt(row, slot, candidates, used) }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const day = parseDayResponse(text, slot, candidates, locale);
    return { day, usage: message.usage, error: day ? undefined : 'unparseable_day' };
  } catch (err) {
    console.error('[tailor-now] Claude day generation failed:', err);
    return { day: null, usage: null, error: err instanceof Error ? err.message.slice(0, 300) : 'claude_failed' };
  }
}

/**
 * Generates up to DAYS_PER_REQUEST of the days this plan is entitled to (Day 1 before payment,
 * every day after). Safe to call repeatedly; a short lock prevents duplicate parallel work.
 */
export async function generateNextTailorDays(token: string): Promise<PublicTailorPlan> {
  const row = await loadTailorPlanByToken(token);
  if (!row) throw new TailorError('not_found', 404);

  const existing = planDays(row);
  const have = new Set(existing.map((d) => d.dayNumber));
  const todo = entitledDayNumbers(row).filter((n) => !have.has(n));
  if (!todo.length) return toPublicPlan(row);

  // Hard ceiling on spend per plan (retries included).
  const usage = asRecord(row.ai_usage);
  if ((Number(usage.calls) || 0) >= row.days_total * 2 + 4) throw new TailorError('generation_limit', 429);

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) throw new TailorError('not_configured', 503);

  const db = admin();
  const now = new Date();
  const cutoff = new Date(now.getTime() - LOCK_TTL_MS).toISOString();
  const { data: locked, error: lockErr } = await db
    .from(TAILOR_TABLE)
    .update({ generation_started_at: now.toISOString() })
    .eq('id', row.id)
    .or(`generation_started_at.is.null,generation_started_at.lt.${cutoff}`)
    .select('id')
    .maybeSingle();
  if (lockErr) throw lockErr;
  if (!locked) throw new TailorError('in_progress', 409);

  try {
    const slots = tailorDaySlots(planSegments(row));
    const batch = todo.slice(0, DAYS_PER_REQUEST).map((n) => slots.find((s) => s.dayNumber === n)).filter(Boolean) as TailorDaySlot[];
    const a = parseTailorAnswers(row.answers);
    const used = new Set(existing.flatMap((d) => d.stops.map((s) => s.placeId).filter(Boolean) as string[]));
    const usedNames = existing.flatMap((d) => d.stops.map((s) => s.placeName).filter(Boolean) as string[]);

    const pools = new Map<string, Candidate[]>();
    for (const slot of batch) {
      if (!pools.has(slot.city)) pools.set(slot.city, await fetchCityPool(row, slot.city));
    }
    // Disjoint shortlists so parallel days in the same city never pick the same places.
    const reserved = new Set(used);
    const jobs = batch.map((slot) => {
      const candidates = pickCandidates(pools.get(slot.city) ?? [], a, reserved);
      for (const c of candidates) reserved.add(c.id);
      return { slot, candidates };
    });

    const client = new Anthropic({ apiKey });
    const results = await Promise.all(
      jobs.map((j) => generateOneDay(client, row, j.slot, j.candidates, usedNames.slice(-80))),
    );

    let nextUsage: unknown = row.ai_usage;
    for (const r of results) nextUsage = addUsage(nextUsage, r.usage);
    const newDays = results.map((r) => r.day).filter(Boolean) as TailorDay[];
    const merged = [...existing, ...newDays].sort((x, y) => x.dayNumber - y.dayNumber);
    const failed = results.find((r) => !r.day);
    const entitled = entitledDayNumbers(row);
    const complete = entitled.every((n) => merged.some((d) => d.dayNumber === n));

    let status: string = row.status;
    if (isPlanUnlocked(row)) status = complete ? 'ready' : 'paid';

    const { data: saved, error: saveErr } = await db
      .from(TAILOR_TABLE)
      .update({
        days: merged,
        ai_usage: nextUsage,
        status,
        last_error: failed && !newDays.length ? failed.error ?? 'generation_failed' : null,
        generation_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (saveErr) throw saveErr;

    if (status === 'ready' && row.status !== 'ready' && row.lead_id) {
      await db.from('leads').update({ status: 'delivered' } as never).eq('id', row.lead_id);
    }
    if (failed && !newDays.length) throw new TailorError('generation_failed', 502);
    return toPublicPlan(saved as TailorPlanRow);
  } catch (err) {
    await db.from(TAILOR_TABLE).update({ generation_started_at: null }).eq('id', row.id);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────── payment

export async function submitTailorReceipt(token: string, receiptUrl: string): Promise<PublicTailorPlan> {
  const row = await loadTailorPlanByToken(token);
  if (!row) throw new TailorError('not_found', 404);
  const url = str(receiptUrl, 1000);
  const prefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/payment_receipts/tailor-now/`;
  if (!url.startsWith(prefix)) {
    throw new TailorError('invalid_receipt');
  }
  const db = admin();
  const next = row.status === 'preview' ? 'receipt_submitted' : row.status;
  const { data, error } = await db
    .from(TAILOR_TABLE)
    .update({ receipt_url: url, receipt_submitted_at: new Date().toISOString(), status: next, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select('*')
    .single();
  if (error) throw error;
  if (row.lead_id && !isPlanUnlocked(row)) {
    await db.from('leads').update({ status: 'awaiting_payment' } as never).eq('id', row.lead_id);
  }
  return toPublicPlan(data as TailorPlanRow);
}

/** CRM: confirm the bank transfer → the remaining days become generatable. */
export async function confirmTailorPayment(planId: string, staffUserId: string | null): Promise<TailorPlanRow> {
  const db = admin();
  const { data: row, error } = await db.from(TAILOR_TABLE).select('*').eq('id', planId).maybeSingle();
  if (error) throw error;
  if (!row) throw new TailorError('not_found', 404);
  const plan = row as TailorPlanRow;
  if (isPlanUnlocked(plan)) return plan;
  const { data, error: upErr } = await db
    .from(TAILOR_TABLE)
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: staffUserId, last_error: null, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .select('*')
    .single();
  if (upErr) throw upErr;
  if (plan.lead_id) await db.from('leads').update({ status: 'payment_confirmed' } as never).eq('id', plan.lead_id);
  return data as TailorPlanRow;
}

export async function listTailorPlansForCrm(limit = 200): Promise<TailorPlanRow[]> {
  const { data, error } = await admin()
    .from(TAILOR_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TailorPlanRow[];
}
