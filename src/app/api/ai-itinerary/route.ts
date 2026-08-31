import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const ACTIVITY_TYPES = ['cafe', 'nature', 'culture', 'action'] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type AiItinerarySuggestion = {
  title: string;
  time: string;
  ai_reasoning: string;
  type: ActivityType;
};

type Body = {
  destination?: string;
  month?: string;
  clientDNA?: unknown;
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
  if (/action|مغامر|نشاط|رياضي/.test(t)) return 'action';
  return 'culture';
}

function parseSuggestions(payload: unknown): AiItinerarySuggestion[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
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
      const title = String(row.title ?? row.name ?? '').trim();
      if (!title) return null;
      return {
        title,
        time: String(row.time ?? row.suggested_time ?? '10:00').trim() || '10:00',
        ai_reasoning: String(row.ai_reasoning ?? row.reasoning ?? row.why ?? '').trim(),
        type: normalizeType(row.type ?? row.category),
      } satisfies AiItinerarySuggestion;
    })
    .filter((x): x is AiItinerarySuggestion => Boolean(x))
    .slice(0, 5);
}

function buildSystemPrompt(destination: string, month: string, clientDNA: unknown): string {
  return `You are a luxury travel architect for Wanderloom.
Destination: ${destination} in ${month}.
Client DNA: ${JSON.stringify(clientDNA)}.

Suggest exactly 3 specific daily activities tailored EXACTLY to this DNA.
Prefer real-feeling place/experience names (not generic filler).
ai_reasoning MUST be in Arabic, max 2 sentences, explaining why it fits this DNA.

Return ONLY a valid JSON object with this exact shape:
{
  "suggestions": [
    {
      "title": "Activity Name",
      "time": "Suggested Time (e.g., 08:00 AM or 16:15)",
      "ai_reasoning": "سبب عربي قصير",
      "type": "cafe" | "nature" | "culture" | "action"
    }
  ]
}`;
}

function fallbackSuggestions(destination: string): AiItinerarySuggestion[] {
  const dest = destination.trim() || 'الوجهة';
  return [
    {
      title: `مقهى هادئ في ${dest}`,
      time: '16:15',
      ai_reasoning: 'لحظة قهوة مقطرة بهدوء تناسب ذوق العميل في الاسترخاء والضوء الذهبي.',
      type: 'cafe',
    },
    {
      title: `نزهة ثقافية خفيفة في ${dest}`,
      time: '10:30',
      ai_reasoning: 'تجربة ثقافية أنيقة دون إرهاق، متوافقة مع إيقاع السفر الفاخر.',
      type: 'culture',
    },
    {
      title: `لمسة طبيعة قريبة من ${dest}`,
      time: '08:00',
      ai_reasoning: 'صباح منعش في الطبيعة يعيد التوازن قبل جدول اليوم.',
      type: 'nature',
    },
  ];
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (auth.access.is_suspended) {
    return NextResponse.json({ ok: false, error: 'الحساب موقوف' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const destination = String(body.destination ?? '').trim() || 'وجهة غير محددة';
  const month = String(body.month ?? '').trim() || 'موسم السفر';
  const clientDNA = body.clientDNA ?? {};

  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
  console.log('[ai-itinerary] API Key Status:', apiKey ? 'EXISTS' : 'MISSING');

  if (!apiKey) {
    console.error('[ai-itinerary] OPENAI_API_KEY is missing from server environment');
    return NextResponse.json(
      {
        ok: false,
        error:
          'مفتاح الذكاء الاصطناعي غير متوفر حالياً. يرجى إضافته في إعدادات Vercel / .env',
      },
      { status: 500 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const model =
      (process.env.OPENAI_ITINERARY_MODEL ?? '').trim() ||
      (process.env.OPENAI_MODEL ?? '').trim() ||
      'gpt-4o-mini';

    console.log('[ai-itinerary] requesting model:', model, 'destination:', destination);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(destination, month, clientDNA),
        },
        {
          role: 'user',
          content:
            'Generate the 3 luxury itinerary activity suggestions now. JSON object only.',
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[ai-itinerary] JSON parse failed:', parseErr, 'raw:', raw.slice(0, 200));
      parsed = {};
    }

    let suggestions = parseSuggestions(parsed);
    if (!suggestions.length) {
      console.warn('[ai-itinerary] empty parse — using local fallback suggestions');
      suggestions = fallbackSuggestions(destination);
      return NextResponse.json({
        ok: true,
        simulated: true,
        model,
        suggestions,
        warning: 'تعذر تفسير رد OpenAI — تم عرض اقتراحات احتياطية.',
      });
    }

    return NextResponse.json({
      ok: true,
      simulated: false,
      model,
      suggestions,
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    const message =
      error instanceof Error ? error.message : 'تعذر الاتصال بـ OpenAI';
    const lower = message.toLowerCase();
    const isAuthKeyIssue =
      /api[\s_-]?key|unauthorized|authentication|invalid.?key|401|incorrect api key/.test(
        lower,
      );

    if (isAuthKeyIssue) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'مفتاح الذكاء الاصطناعي غير متوفر حالياً. يرجى إضافته في إعدادات Vercel / .env',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: `تعذر الاتصال بخدمة الذكاء الاصطناعي: ${message}`,
        suggestions: fallbackSuggestions(destination),
        simulated: true,
      },
      { status: 502 },
    );
  }
}
