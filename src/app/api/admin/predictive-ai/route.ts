import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CLAUDE_MODEL = 'claude-sonnet-4-5' as const;

const ACTIVITY_TYPES = ['cafe', 'nature', 'culture', 'action'] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type PredictiveAiStop = {
  title: string;
  time: string;
  ai_reasoning: string;
  type: ActivityType;
  category?: string;
  notes?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeType(raw: unknown): ActivityType {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase();
  if ((ACTIVITY_TYPES as readonly string[]).includes(t)) return t as ActivityType;
  if (/cafe|coffee|مقهى|قهوة/.test(t)) return 'cafe';
  if (/nature|طبيعة|حديق|متنزه/.test(t)) return 'nature';
  if (/culture|ثقاف|متحف|معبد|هانوك/.test(t)) return 'culture';
  if (/action|مغامر|نشاط|رياضي|تجرب/.test(t)) return 'action';
  return 'culture';
}

function normalizeStops(payload: unknown): PredictiveAiStop[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.stops)
      ? root.stops
      : Array.isArray(root.suggestions)
        ? root.suggestions
        : Array.isArray(root.activities)
          ? root.activities
          : Array.isArray(root.items)
            ? root.items
            : [];

  return list
    .map((item) => {
      const row = asRecord(item);
      const title = String(row.title ?? row.name ?? row.place_name ?? '').trim();
      if (!title) return null;
      return {
        title,
        time: String(row.time ?? row.suggested_time ?? row.visit_time ?? '16:15').trim() || '16:15',
        ai_reasoning: String(
          row.ai_reasoning ?? row.reasoning ?? row.why ?? row.notes ?? '',
        ).trim(),
        type: normalizeType(row.type ?? row.category),
        category: String(row.category ?? '').trim() || undefined,
        notes: String(row.notes ?? row.story ?? '').trim() || undefined,
      } satisfies PredictiveAiStop;
    })
    .filter((x): x is PredictiveAiStop => Boolean(x))
    .slice(0, 8);
}

const WANDERLOOM_PREDICTIVE_SYSTEM = `You are Wanderloom's Predictive AI Travel Engineer.

Output ONLY valid JSON containing a "stops" array. No markdown. No intro text.

Each stop must include: title, time (HH:MM), ai_reasoning (Arabic), type (cafe|nature|culture|action), notes, beat (Arabic beat name).

Wanderloom Standard — STRICT 8-step daily stop sequence (output exactly these 8 stops in this order):
1. الصحوة (Lodging / Wakeup)
2. الإفطار (Bespoke Breakfast)
3. الشارع المميز (Signature Street Walk)
4. القهوة المختصة (Specialty Coffee)
5. المعلم الأساسي (Highlight Attraction)
6. تجربة خاصة (Immersive Private Experience)
7. المنطقة الليلية (Evening District)
8. العشاء (Gourmet Dining)

Match every stop to the client's travel DNA. Prefer quiet VIP venues — never generic tourist traps.
Suggested type mapping: 1=culture, 2=cafe, 3=culture, 4=cafe, 5=culture|nature, 6=action, 7=culture, 8=cafe.`;

/**
 * POST /api/admin/predictive-ai
 * Foolproof Claude path with explicit logging — no silent failures.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedCrmUser(req);
    if ('error' in auth) {
      console.error('[Predictive AI Error] Auth failed:', auth.error);
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!auth.user) {
      console.error('[Predictive AI Error] Unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (auth.access.is_suspended) {
      return NextResponse.json({ error: 'الحساب موقوف' }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    console.log('[Predictive AI] Key check:', {
      startsWith: apiKey?.substring(0, 10) ?? 'missing',
      length: apiKey?.length ?? 0,
    });

    if (!apiKey) {
      console.error('[Predictive AI Error] Missing ANTHROPIC_API_KEY');
      return NextResponse.json(
        { error: 'مفتاح ANTHROPIC_API_KEY غير متوفر في إعدادات البيئة' },
        { status: 400 },
      );
    }

    const body = await req.json();
    console.log('[Predictive AI] Request body keys:', Object.keys(asRecord(body)));

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.7,
      system: WANDERLOOM_PREDICTIVE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Generate exactly 8 sensory itinerary stops for ONE full day, STRICTLY in Wanderloom's 8-step order (الصحوة → الإفطار → الشارع المميز → القهوة المختصة → المعلم الأساسي → تجربة خاصة → المنطقة الليلية → العشاء). Context: ${JSON.stringify(body)}`,
        },
      ],
    });

    const textContent =
      response.content[0]?.type === 'text' ? response.content[0].text : '';
    console.log('[Claude Output]:', textContent);

    const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('لم يتمكن Claude من صياغة استجابة JSON صحيحة.');
    }

    const parsedData = JSON.parse(jsonMatch[0]) as unknown;
    const stops = normalizeStops(parsedData);

    if (!stops.length) {
      console.error('[Predictive AI Error] Empty stops after normalize:', parsedData);
      return NextResponse.json(
        { error: 'Claude لم يُرجع محطات صالحة. أعد التوليد.', stops: [] },
        { status: 502 },
      );
    }

    console.log('[Predictive AI] Success — stops:', stops.length);

    // Return both shapes: `stops` (canonical) + `suggestions` (modal compat)
    return NextResponse.json({
      ok: true,
      model: CLAUDE_MODEL,
      provider: 'anthropic',
      stops,
      suggestions: stops,
    });
  } catch (err: unknown) {
    console.error('[Predictive AI Fatal Error]:', err);
    const message =
      err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب مع Claude';
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;

    return NextResponse.json(
      {
        error:
          status === 401 || /authentication|api[_ ]?key|unauthorized|invalid/i.test(message)
            ? 'يرجى التحقق من مفتاح Anthropic في إعدادات البيئة'
            : message || 'حدث خطأ أثناء معالجة الطلب مع Claude',
      },
      { status: status || 500 },
    );
  }
}
