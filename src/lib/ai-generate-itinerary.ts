/** Claude-powered full-day itinerary generation for CRM builders */

export type GeneratedItineraryStop = {
  title: string;
  time: string;
  notes: string;
  category: string;
  search_keyword: string;
  /** Curated Unsplash / Places photo URL (filled server-side after Claude) */
  image_url?: string;
  /** Hidden expert-only ref to the chosen real row in the `places` bank. */
  place_id?: string;
  /** Hidden real name of the chosen place (filled server-side after validation). */
  place_real_name?: string;
};

/** A real row from the `places` bank offered to Claude as a hard candidate. */
export type PlaceCandidate = {
  id: string;
  name: string;
  name_en?: string;
  city?: string;
  category?: string;
  sub_tag?: string;
  rating?: number | null;
};

export type GeneratedItineraryDay = {
  dayNumber: number;
  title: string;
  city: string;
  stops: GeneratedItineraryStop[];
};

export type GenerateItineraryRequest = {
  destination: string;
  daysCount: number;
  clientName?: string;
  interests?: string[];
  dna?: Record<string, unknown> | null;
  dietary?: string;
  hotelPreferences?: string;
  secretNotes?: string;
  tripDateFrom?: string;
  tripDateTo?: string;
  chatContext?: string;
  /** Real rows from the `places` bank Claude MUST choose stops from (when provided). */
  placeCandidates?: PlaceCandidate[];
};

export const WANDERLOOM_ITINERARY_ENGINEER_SYSTEM = `You are Wanderloom's Senior Travel Engineer.
Design bespoke sensory luxury itineraries for VIP Saudi/Gulf travelers.

Signature daily rhythm — Wanderloom Standard 8-step flow (include ALL eight beats every full day, STRICTLY in this order):
1. الصحوة (Lodging / Wakeup) — morning lodging ritual / room awakening
2. الإفطار (Bespoke Breakfast) — artisanal, locally specific breakfast
3. الشارع المميز (Signature Street Walk) — distinctive street / boutique walk matching client DNA
4. القهوة المختصة (Specialty Coffee) — specialty coffee moment
5. المعلم الأساسي (Highlight Attraction) — the day's primary highlight landmark (quiet VIP feel, not a tourist trap)
6. تجربة خاصة (Immersive Private Experience) — exclusive immersive private activity
7. المنطقة الليلية (Evening District) — evening district / nightlife-adjacent atmosphere (elegant, not chaotic)
8. العشاء (Gourmet Dining) — gourmet dinner close

Rules:
- Output MUST be valid JSON only (no markdown fences, no commentary).
- Each day's "stops" array MUST contain exactly 8 stops in the order above.
- Write stop titles and sensory notes in Arabic (elegant, concrete, place-feeling). Prefix or weave the Arabic beat name (الصحوة، الإفطار، …) into the stop identity when natural.
- search_keyword: short English/local search phrase useful for Google Maps / places bank lookup.
- category codes ONLY from: h (hotel/lodging), c (cafe/coffee), r (restaurant/food), s (shopping), l (landmark), d (experience), f (family fun), o (other).
  Map beats → categories: 1=h, 2=r, 3=s, 4=c, 5=l, 6=d, 7=s|o, 8=r.
- Times as HH:MM (24h), realistic spacing from morning wakeup through late dinner.
- Tailor every stop to the provided DNA, interests, dietary limits, and destination.
- Prefer quiet, uncrowded, VIP-feeling venues — never generic tourist traps.

REAL PLACES BANK (Golden Rule):
- When a "Real place candidates" list is provided, you MUST pick each stop from that list whenever a candidate fits the beat's category. Set "place_id" to the candidate's EXACT id.
- The visible "title" and "notes" MUST stay sensory, anonymous Arabic — DO NOT write the real place name in title/notes (e.g. instead of "مقهى Anthracite" write "صباحٌ يبدأ بقهوةٍ هادئة في زقاقٍ لا يعرفه السياح"). The real name stays hidden in the reference only.
- Only if NO candidate fits a beat, leave "place_id" empty and rely on "search_keyword". Never invent a place_id that is not in the provided list.`;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeCategory(raw: unknown): string {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (['h', 'c', 'r', 's', 'l', 'd', 'f', 'o'].includes(t)) return t;
  if (/hotel|lodg|صحو|إقام|فندق|wakeup/.test(t)) return 'h';
  if (/coffee|cafe|قهو|مقهى|مختص/.test(t)) return 'c';
  if (/breakfast|dinner|lunch|restaurant|عشاء|إفطار|افطار|فطور|غدا|مطعم|bakery|gourmet/.test(t))
    return 'r';
  if (/shop|street|شارع|محل|تسوق|district|منطقة|ليل/.test(t)) return 's';
  if (/landmark|highlight|معلم|attraction|أساسي/.test(t)) return 'l';
  if (/experience|private|تجرب|خاص|immersive/.test(t)) return 'd';
  return 'o';
}

function normalizeTime(raw: unknown, fallback: string): string {
  const s = String(raw ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return fallback;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/** Default clock for the official Wanderloom 8-step daily flow */
const DEFAULT_BEAT_TIMES = [
  '07:30', // الصحوة
  '08:30', // الإفطار
  '10:00', // الشارع المميز
  '11:15', // القهوة المختصة
  '13:00', // المعلم الأساسي
  '15:30', // تجربة خاصة
  '18:30', // المنطقة الليلية
  '20:30', // العشاء
];

export function parseGeneratedItineraryPayload(payload: unknown): GeneratedItineraryDay[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.days)
      ? root.days
      : Array.isArray(root.itinerary)
        ? root.itinerary
        : Array.isArray(root.itinerary_days)
          ? root.itinerary_days
          : [];

  return list
    .map((item, index) => {
      const row = asRecord(item);
      const stopsRaw = Array.isArray(row.stops)
        ? row.stops
        : Array.isArray(row.itinerary_stops)
          ? row.itinerary_stops
          : Array.isArray(row.activities)
            ? row.activities
            : Array.isArray(row.places)
              ? row.places
              : Array.isArray(row.schedule)
                ? row.schedule
                : [];

      const stops: GeneratedItineraryStop[] = stopsRaw
        .map((stopItem, stopIndex) => {
          const s = asRecord(stopItem);
          const title = String(s.title ?? s.place_name ?? s.name ?? s.activity ?? '').trim();
          if (!title) return null;
          return {
            title,
            time: normalizeTime(s.time ?? s.visit_time ?? s.time_slot, DEFAULT_BEAT_TIMES[stopIndex] ?? '10:00'),
            notes: String(s.notes ?? s.note ?? s.story ?? s.description ?? '').trim(),
            category: normalizeCategory(s.category),
            search_keyword: String(s.search_keyword ?? s.keyword ?? s.query ?? '').trim(),
            image_url: String(s.image_url ?? s.photo ?? '').trim() || undefined,
            place_id: String(s.place_id ?? s.placeId ?? '').trim() || undefined,
          } satisfies GeneratedItineraryStop;
        })
        .filter((x): x is GeneratedItineraryStop => x != null);

      // Day with title/city but no stops — keep as a single placeholder stop so parsing succeeds
      if (!stops.length) {
        const dayTitle = String(row.title ?? row.name ?? '').trim();
        const dayDesc = String(row.description ?? row.summary ?? row.notes ?? '').trim();
        if (!dayTitle && !dayDesc && !String(row.city ?? '').trim()) return null;
        stops.push({
          title: dayTitle || dayDesc || `محطة اليوم ${index + 1}`,
          time: '10:00',
          notes: dayDesc,
          category: 'o',
          search_keyword: String(row.city ?? '').trim(),
        });
      }

      return {
        dayNumber: Math.max(1, Math.trunc(Number(row.dayNumber ?? row.day_number ?? index + 1) || index + 1)),
        title: String(row.title ?? row.name ?? `اليوم ${index + 1}`).trim() || `اليوم ${index + 1}`,
        city: String(row.city ?? '').trim(),
        stops,
      } satisfies GeneratedItineraryDay;
    })
    .filter((x): x is GeneratedItineraryDay => x != null);
}

/**
 * Strip markdown fences / prose and parse Claude JSON.
 * Handles ```json … ```, leading prose, and lightly truncated objects.
 */
export function extractJsonObject(text: string): unknown {
  let raw = String(text ?? '').trim();
  if (!raw) return {};

  // 1) Strip all markdown code fences (```json / ```)
  raw = raw.replace(/```(?:json|JSON)?\s*/gi, '').replace(/```/g, '').trim();

  // 2) Direct parse
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }

  // 3) Slice outermost object / array
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    const slice = raw.slice(objStart, objEnd + 1);
    try {
      return JSON.parse(slice);
    } catch {
      const repaired = repairTruncatedJson(slice);
      if (repaired != null) return repaired;
    }
  }

  const arrStart = raw.indexOf('[');
  const arrEnd = raw.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    const slice = raw.slice(arrStart, arrEnd + 1);
    try {
      return JSON.parse(slice);
    } catch {
      const repaired = repairTruncatedJson(slice);
      if (repaired != null) return repaired;
    }
  }

  // 4) Truncated mid-response: take from first { and close brackets
  if (objStart >= 0) {
    const repaired = repairTruncatedJson(raw.slice(objStart));
    if (repaired != null) return repaired;
  }

  return {};
}

/** Best-effort close of truncated JSON (common when max_tokens cuts mid-object). */
function repairTruncatedJson(slice: string): unknown | null {
  let s = slice.trim();
  if (!s) return null;

  // Drop trailing incomplete string value: ,"key": "unfinished…
  s = s.replace(/,\s*"[^"]*":\s*"[^"]*$/s, '');
  s = s.replace(/,\s*"[^"]*":\s*$/s, '');
  s = s.replace(/,\s*"[^"]*$/s, '');
  s = s.replace(/,\s*$/s, '');

  // Close open strings
  let quoteCount = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\') {
      i += 1;
      continue;
    }
    if (s[i] === '"') quoteCount += 1;
  }
  if (quoteCount % 2 === 1) s += '"';

  const opens: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') opens.push(ch);
    if (ch === '}' || ch === ']') opens.pop();
  }

  while (opens.length) {
    const open = opens.pop();
    s += open === '{' ? '}' : ']';
  }

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Compact, token-lean rendering of the real place candidates for the prompt. */
function formatPlaceCandidates(candidates: PlaceCandidate[]): string {
  if (!candidates.length) return 'none provided — use search_keyword for every stop';
  return candidates
    .map((c) => {
      const label = [c.name, c.name_en].filter(Boolean).join(' / ');
      const meta = [c.category, c.sub_tag, c.city].filter(Boolean).join(' · ');
      const rating = typeof c.rating === 'number' ? ` ★${c.rating}` : '';
      return `- id=${c.id} | ${label} | ${meta}${rating}`;
    })
    .join('\n');
}

export function buildGenerateItineraryUserPrompt(input: GenerateItineraryRequest): string {
  const days = Math.min(14, Math.max(1, Math.trunc(Number(input.daysCount) || 1)));
  const candidates = input.placeCandidates ?? [];
  return [
    `Destination: ${input.destination.trim() || 'TBD'}`,
    `Number of days: ${days}`,
    `Client name: ${String(input.clientName ?? '').trim() || 'VIP Client'}`,
    `Interests: ${(input.interests ?? []).filter(Boolean).join(', ') || 'not specified'}`,
    `Travel DNA JSON: ${JSON.stringify(input.dna ?? {})}`,
    `Dietary: ${String(input.dietary ?? '').trim() || 'n/a'}`,
    `Hotel preferences: ${String(input.hotelPreferences ?? '').trim() || 'n/a'}`,
    `VIP / secret notes: ${String(input.secretNotes ?? '').trim() || 'n/a'}`,
    `Trip dates: ${String(input.tripDateFrom ?? '').trim() || '?'} → ${String(input.tripDateTo ?? '').trim() || '?'}`,
    `Additional chat / briefing context: ${String(input.chatContext ?? '').trim() || 'n/a'}`,
    '',
    'Real place candidates (choose stops from these by exact id — Golden Rule applies):',
    formatPlaceCandidates(candidates),
    '',
    `Generate exactly ${days} day(s). Each day MUST include ALL 8 Wanderloom Standard stops in order: الصحوة → الإفطار → الشارع المميز → القهوة المختصة → المعلم الأساسي → تجربة خاصة → المنطقة الليلية → العشاء.`,
    'For each stop, set "place_id" to a candidate id when one fits the beat; otherwise leave "place_id" as "" and provide a search_keyword. Never invent an id.',
    'Return ONLY this JSON shape:',
    JSON.stringify(
      {
        days: [
          {
            dayNumber: 1,
            title: 'string',
            city: 'string',
            stops: [
              {
                title: 'sensory Arabic title (no real place name)',
                time: 'HH:MM',
                notes: 'sensory Arabic notes (no real place name)',
                category: 'c',
                search_keyword: 'english place search phrase',
                place_id: 'exact candidate id or empty string',
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  ].join('\n');
}
