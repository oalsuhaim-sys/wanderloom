import Anthropic from '@anthropic-ai/sdk';

import { extractJsonObject } from '@/lib/ai-generate-itinerary';
import { interestLabelAr } from '@/lib/dna-day-themes';
import type { QuotationItineraryDay } from '@/lib/interactive-quotation';

/**
 * Copywriting pass for DNA quotes: Claude rewrites each day's title, description and stop notes in
 * persuasive, personal Arabic based on the client's DNA — keeping the chosen places, order and times.
 * One call per city segment, in parallel, within a time budget. Any failure keeps the template copy.
 */

export type DnaCopyProfile = {
  clientName: string;
  interests: string[];
  pace: string;
  food: string[];
  lodging: string;
  dream: string;
  notes: string;
  firstVisit: boolean;
  travelers: string;
  country: string;
};

const SYSTEM = `You write the day-by-day pages of a private travel proposal for Wanderloom, a Saudi bespoke-travel house («واندرلوم: تفصيل لا تنظيم»).
The reader is the client deciding whether to approve. Your words must make each day feel designed for THEM: connect every day to their interests, pace and what they want to feel.

Rules:
- Elegant, warm Modern Standard Arabic that reads naturally to Saudis. No English words.
- Each day must feel different: its own angle, its own emotion. Never repeat the same sentence pattern across days.
- "title": 3–6 words, evocative, no day number, no city prefix like «اليوم».
- "description": 2 sentences max. Speak to the client ("ستعيش", "ستجد") and tie the day to their interests or desired feeling.
- For each stop write "title" (sensory, 3–7 words) and "notes" (one sentence: why it suits them + one practical tip).
- NEVER reveal real place names, brands or addresses in title or notes (the proposal keeps venues private until booking). Describe the experience instead.
- Food: respect halal; for meat-based restaurants add a short tip to confirm halal options.
- Do not mention AI, algorithms, or that anyone «generated» the plan. Do not use «باقة», «عرض», «خصم», «تنظيم رحلات».
- Keep the same number and order of stops you are given. Output ONLY JSON.`;

function model(): string {
  return (
    (process.env.ANTHROPIC_PROPOSAL_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-opus-5-5'
  );
}

function profileLines(p: DnaCopyProfile): string {
  return [
    `Client: ${p.clientName || 'العميل'} · ${p.travelers || 'travelers not specified'}`,
    `Country: ${p.country}`,
    `Interests: ${p.interests.map(interestLabelAr).join('، ') || 'غير محددة'}`,
    `Pace: ${p.pace || 'متوسط'}`,
    `Food: ${p.food.join('، ') || 'بدون قيود'}`,
    `Stay preference: ${p.lodging || '—'}`,
    p.dream ? `What they want to feel: ${p.dream}` : '',
    p.notes ? `Their notes: ${p.notes}` : '',
    p.firstVisit ? 'First visit to this country.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function segmentPrompt(p: DnaCopyProfile, days: QuotationItineraryDay[]): string {
  const dayLines = days
    .map((d) => {
      const stops = d.stops
        .map(
          (s, i) =>
            `   ${i + 1}. ${s.time} · [${s.category}] ${s.place_real_name || s.title}${s.notes ? ` — ${s.notes.slice(0, 140)}` : ''}`,
        )
        .join('\n');
      return `Day ${d.dayNumber} · ${d.city}${d.date ? ` · ${d.date}` : ''}\n  Draft angle: ${d.title} — ${d.description}\n  Stops (keep order):\n${stops || '   (no venues yet — write title/description only, stops: [])'}`;
    })
    .join('\n\n');
  return [
    profileLines(p),
    '',
    'Days to write (category codes: c café, r restaurant, s shopping/street, l landmark, d experience, f family, o other):',
    dayLines,
    '',
    'Return ONLY:',
    '{"days":[{"dayNumber":1,"title":"…","description":"…","stops":[{"title":"…","notes":"…"}]}]}',
  ].join('\n');
}

type CopyDay = { dayNumber: number; title?: string; description?: string; stops?: Array<{ title?: string; notes?: string }> };

function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Never let a real venue name slip into client-visible text. */
function leaksName(text: string, names: string[]): boolean {
  const t = text.toLowerCase();
  return names.some((n) => n && n.length >= 4 && t.includes(n.toLowerCase()));
}

async function writeSegment(client: Anthropic, p: DnaCopyProfile, days: QuotationItineraryDay[], signal: AbortSignal): Promise<CopyDay[]> {
  const msg = await client.messages.create(
    {
      model: model(),
      max_tokens: 1200 + days.length * 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: segmentPrompt(p, days) }],
    },
    { signal },
  );
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const root = extractJsonObject(text) as { days?: CopyDay[] } | null;
  return Array.isArray(root?.days) ? root!.days! : [];
}

/** Returns new days with Claude copy applied where it succeeded. */
export async function polishDnaDaysWithClaude(
  days: QuotationItineraryDay[],
  profile: DnaCopyProfile,
  opts: { budgetMs?: number } = {},
): Promise<{ days: QuotationItineraryDay[]; polished: number }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey || !days.length) return { days, polished: 0 };

  // Segments of consecutive days in the same city, max 4 days each (keeps every call fast).
  const segments: QuotationItineraryDay[][] = [];
  for (const d of days) {
    const last = segments[segments.length - 1];
    if (last && last[0]!.city === d.city && last.length < 4) last.push(d);
    else segments.push([d]);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.budgetMs ?? 75_000);
  const client = new Anthropic({ apiKey });
  try {
    const results = await Promise.allSettled(segments.map((seg) => writeSegment(client, profile, seg, controller.signal)));
    const byDay = new Map<number, CopyDay>();
    for (const r of results) {
      if (r.status !== 'fulfilled') {
        console.warn('[dna-proposal-claude] segment failed:', r.reason instanceof Error ? r.reason.message : r.reason);
        continue;
      }
      for (const d of r.value) if (Number(d.dayNumber) > 0) byDay.set(Number(d.dayNumber), d);
    }
    let polished = 0;
    const next = days.map((day) => {
      const c = byDay.get(day.dayNumber);
      if (!c) return day;
      const names = day.stops.map((s) => s.place_real_name ?? '').filter(Boolean);
      const title = clean(c.title, 80);
      const description = clean(c.description, 400);
      polished += 1;
      return {
        ...day,
        title: title && !leaksName(title, names) ? title : day.title,
        description: description && !leaksName(description, names) ? description : day.description,
        stops: day.stops.map((s, i) => {
          const cs = c.stops?.[i];
          const st = clean(cs?.title, 90);
          const sn = clean(cs?.notes, 300);
          return {
            ...s,
            title: st && !leaksName(st, names) ? st : s.title,
            notes: sn && !leaksName(sn, names) ? sn : s.notes,
          };
        }),
      };
    });
    return { days: next, polished };
  } catch (err) {
    console.warn('[dna-proposal-claude] polish skipped:', err instanceof Error ? err.message : err);
    return { days, polished: 0 };
  } finally {
    clearTimeout(timer);
  }
}
