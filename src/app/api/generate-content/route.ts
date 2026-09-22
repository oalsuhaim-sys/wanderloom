import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

import {
  buildMarketingContentInsertFromGenerator,
  fetchMarketingPipelineItems,
  insertMarketingContentRow,
  mapMarketingContentRowToPipelineItem,
} from '@/lib/marketing-content-pipeline';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildFallbackGeneratorResult,
  parseGeneratorResult,
  resolvePhilosophyForFormat,
  WANDERLOOM_GENERATOR_SYSTEM_PROMPT,
  type WanderloomGeneratorResult,
} from '@/lib/wanderloom-generator';

export const runtime = 'nodejs';

type GenerateContentBody = {
  format?: string;
  platform?: string;
  audience?: string;
  theme?: string;
  philosophy?: string;
  topic?: string;
  destination?: string;
  funnel_stage?: string;
  stage?: string;
  idea_name?: string;
  id?: string;
};

function trimField(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toLegacyContent(result: WanderloomGeneratorResult) {
  return {
    idea: result.idea_name,
    hook: result.script_section.beats[0]?.line ?? '',
    caption: result.caption_section.body,
    script: result.script_markdown,
    cta: result.cta_section.text,
    hashtags: result.caption_section.hashtags,
    visual_notes: [
      result.direction_section.video_sources,
      result.direction_section.music,
      result.direction_section.color_grade,
    ]
      .filter(Boolean)
      .join('\n'),
    format: result.format,
    platform: result.platform,
    audience: result.audience,
    theme: result.philosophy,
    topic: result.topic,
  };
}

async function persistGeneratorResult(input: {
  result: WanderloomGeneratorResult;
  topic: string;
  format: string;
  platform: string;
  destination: string;
  funnelStage: string;
  audience: string;
  philosophy: string;
}) {
  try {
    const admin = createSupabaseAdminClient();
    const payload = buildMarketingContentInsertFromGenerator(input);
    const saved = await insertMarketingContentRow(admin, payload);
    if (!saved.ok) {
      return { saved: false as const, error: saved.error, pipelineItem: null };
    }
    return {
      saved: true as const,
      error: null as string | null,
      row: saved.row,
      pipelineItem: mapMarketingContentRowToPipelineItem(saved.row),
    };
  } catch (err) {
    return {
      saved: false as const,
      error: err instanceof Error ? err.message : 'persist_failed',
      pipelineItem: null,
    };
  }
}

/** List pipeline rows from marketing_content for the Content table tab. */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (auth.access.is_suspended) {
    return NextResponse.json({ ok: false, error: 'الحساب موقوف' }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const listed = await fetchMarketingPipelineItems(admin);
    if (!listed.ok) {
      return NextResponse.json({ ok: false, error: listed.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, items: listed.items });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'fetch_failed',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (auth.access.is_suspended) {
    return NextResponse.json({ ok: false, error: 'الحساب موقوف' }, { status: 403 });
  }

  let body: GenerateContentBody;
  try {
    body = (await request.json()) as GenerateContentBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const format = trimField(body.format);
  const platform = trimField(body.platform);
  const audience = trimField(body.audience);
  const philosophyRaw = trimField(body.philosophy ?? body.theme, 'تلقائي حسب الصيغة —');
  const topic = trimField(body.topic);
  const destination = trimField(body.destination, 'كوريا');
  const funnel_stage = trimField(body.funnel_stage ?? body.stage, 'الوعي');
  const idea_name = trimField(body.idea_name);
  const id = trimField(body.id, `WL-${Date.now().toString().slice(-6)}`);
  const philosophy = resolvePhilosophyForFormat(format, philosophyRaw);

  if (!format || !platform || !audience || !topic) {
    return NextResponse.json(
      {
        ok: false,
        error: 'الحقول المطلوبة ناقصة: format, platform, audience, topic',
      },
      { status: 400 },
    );
  }

  const fallbackInput = {
    id,
    format,
    platform,
    destination,
    funnel_stage,
    audience,
    philosophy,
    topic,
    idea_name: idea_name || undefined,
  };

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'مفتاح Anthropic غير متوفر. أضف ANTHROPIC_API_KEY في .env.local / Vercel.',
      },
      { status: 500 },
    );
  }

  const model =
    (process.env.ANTHROPIC_CONTENT_MODEL ?? '').trim() ||
    (process.env.ANTHROPIC_MODEL ?? '').trim() ||
    'claude-sonnet-4-5';

  const userBrief = `أنشئ محتوى Wanderloom الكامل كـ JSON فقط حسب المخطط الإلزامي.

المعطيات:
- المعرف: ${id}
- الصيغة الإنتاجية: ${format}
- المنصّة: ${platform}
- الوجهة: ${destination}
- مرحلة القمع: ${funnel_stage}
- الشريحة المستهدفة: ${audience}
- العمود الفلسفي: ${philosophy}
- اسم الفكرة: ${idea_name || '(ابنِه تلقائياً من الموضوع والوجهة)'}
- الموضوع: ${topic}

أعد JSON فقط — بدون Markdown fences.`;

  const persistMeta = {
    topic,
    format,
    platform,
    destination,
    funnelStage: funnel_stage,
    audience,
    philosophy,
  };

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model,
      max_tokens: 4500,
      temperature: 0.7,
      system: WANDERLOOM_GENERATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userBrief }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const result = parseGeneratorResult(rawText, fallbackInput);
    const persist = await persistGeneratorResult({ result, ...persistMeta });

    return NextResponse.json({
      ok: true,
      model,
      format: 'wanderloom_generator_prototype_v1',
      result,
      content: toLegacyContent(result),
      saved: persist.saved,
      saveError: persist.error,
      pipelineItem: persist.pipelineItem,
      row: persist.saved ? persist.row : null,
    });
  } catch (error) {
    console.error('[generate-content]', error);
    const detail = error instanceof Error ? error.message : 'claude_request_failed';
    const result: WanderloomGeneratorResult = buildFallbackGeneratorResult(fallbackInput);
    // Still attempt to persist the fallback template so the table stays in sync.
    const persist = await persistGeneratorResult({ result, ...persistMeta });

    return NextResponse.json(
      {
        ok: false,
        error: 'فشل توليد المحتوى عبر Claude.',
        detail,
        simulated: true,
        result,
        content: toLegacyContent(result),
        saved: persist.saved,
        saveError: persist.error,
        pipelineItem: persist.pipelineItem,
        row: persist.saved ? persist.row : null,
      },
      { status: 502 },
    );
  }
}
