import type { SupabaseClient } from '@supabase/supabase-js';

import type { WanderloomGeneratorResult } from '@/lib/wanderloom-generator';

export type MarketingContentStatus = 'جاهز للنشر' | 'قيد الإنتاج' | 'فكرة';

export type MarketingPipelineItem = {
  id: string;
  idea: string;
  format: string;
  platform: string;
  stage: string;
  status: MarketingContentStatus | string;
  metrics?: string;
  destination?: string;
  /** Full Wanderloom Master Script (Markdown) */
  script?: string;
};

export type MarketingContentInsertInput = {
  title: string;
  production_type: string;
  content_type: string;
  destination: string;
  funnel_stage: string;
  target_audience: string;
  philosophy_pillar: string;
  status: string;
  stage: string;
  metrics: string;
  script: string;
  caption?: string;
  idea_code?: string;
  prompt?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function trimField(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/** Build insert payload from Claude generator result + form meta. */
export function buildMarketingContentInsertFromGenerator(input: {
  result: WanderloomGeneratorResult;
  topic: string;
  format: string;
  platform: string;
  destination: string;
  funnelStage: string;
  audience: string;
  philosophy: string;
}): MarketingContentInsertInput {
  const { result } = input;
  return {
    title: trimField(result.idea_name, input.topic),
    production_type: trimField(input.format, result.format),
    content_type: trimField(input.platform, result.platform),
    destination: trimField(input.destination, result.destination),
    funnel_stage: trimField(input.funnelStage, result.funnel_stage),
    target_audience: trimField(input.audience, result.audience),
    philosophy_pillar: trimField(input.philosophy, result.philosophy),
    status: 'فكرة',
    stage: 'فكرة',
    metrics: '-',
    script: trimField(
      result.script_markdown || result.script_section.full_script_text,
    ),
    caption: [
      result.caption_section.body.trim(),
      result.caption_section.hashtags.join(' '),
    ]
      .filter(Boolean)
      .join('\n\n'),
    idea_code: trimField(result.id),
    prompt: trimField(input.topic),
  };
}

/**
 * Insert into marketing_content with progressive payload lean-down
 * for environments that have not applied the full schema migration yet.
 */
export async function insertMarketingContentRow(
  admin: SupabaseClient,
  payload: MarketingContentInsertInput,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const attempts: Record<string, unknown>[] = [
    {
      title: payload.title,
      production_type: payload.production_type,
      content_type: payload.content_type,
      destination: payload.destination,
      funnel_stage: payload.funnel_stage,
      target_audience: payload.target_audience,
      philosophy_pillar: payload.philosophy_pillar,
      status: payload.status,
      stage: payload.stage,
      metrics: payload.metrics,
      script: payload.script,
      caption: payload.caption ?? '',
      idea_code: payload.idea_code ?? '',
      prompt: payload.prompt ?? '',
      media_type: 'فيديو',
      content_category: payload.philosophy_pillar || 'أخرى',
    },
    // Legacy studio constraint: production_type ∈ (ai, human)
    {
      title: payload.title,
      production_type: 'ai',
      content_type: payload.content_type,
      destination: payload.destination,
      funnel_stage: payload.funnel_stage,
      target_audience: payload.target_audience,
      philosophy_pillar: payload.philosophy_pillar,
      status: payload.status,
      stage: payload.stage,
      metrics: payload.metrics,
      script: payload.script,
      caption: payload.caption ?? '',
      idea_code: payload.idea_code ?? '',
      prompt: `${payload.production_type} · ${payload.prompt ?? ''}`.trim(),
      media_type: 'فيديو',
      content_category: payload.philosophy_pillar || 'أخرى',
    },
    {
      title: payload.title,
      production_type: 'ai',
      status: payload.status,
      script: payload.script,
      caption: payload.caption ?? '',
      prompt: payload.prompt ?? '',
      media_type: 'فيديو',
    },
    {
      title: payload.title,
      production_type: 'ai',
      status: payload.status,
      script: payload.script,
      prompt: payload.prompt ?? '',
    },
  ];

  let lastError = '';
  for (const row of attempts) {
    const { data, error } = await admin
      .from('marketing_content')
      .insert(row)
      .select('*')
      .limit(1);

    if (error) {
      lastError = error.message ?? 'insert_failed';
      if (
        /column|schema cache|does not exist|check constraint|violates|null value/i.test(
          lastError,
        )
      ) {
        continue;
      }
      continue;
    }

    const saved = Array.isArray(data) ? data[0] : data;
    if (saved && typeof saved === 'object') {
      return { ok: true, row: saved as Record<string, unknown> };
    }
  }

  return {
    ok: false,
    error: lastError || 'تعذر حفظ المحتوى في marketing_content.',
  };
}

export function mapMarketingContentRowToPipelineItem(
  row: Record<string, unknown>,
): MarketingPipelineItem | null {
  const id = trimField(row.idea_code || row.id);
  const idea = trimField(row.title);
  if (!id && !idea) return null;

  const format = trimField(
    row.production_type && !['ai', 'human'].includes(String(row.production_type))
      ? row.production_type
      : row.content_format || row.format,
    trimField(row.production_type, 'ai'),
  );

  return {
    id: id || trimField(row.id, `WL-${Date.now().toString().slice(-6)}`),
    idea: idea || 'فكرة بدون عنوان',
    format,
    platform: trimField(row.content_type || row.platform, '—'),
    stage: trimField(row.stage, trimField(row.status, 'فكرة')),
    status: trimField(row.status, 'فكرة'),
    metrics: trimField(row.metrics, '-'),
    destination: trimField(row.destination) || undefined,
    script: trimField(row.script) || undefined,
  };
}

export async function fetchMarketingPipelineItems(
  admin: SupabaseClient,
): Promise<
  | { ok: true; items: MarketingPipelineItem[] }
  | { ok: false; error: string }
> {
  const selectAttempts = [
    'id, idea_code, title, production_type, content_type, destination, funnel_stage, target_audience, philosophy_pillar, status, stage, metrics, script, caption, created_at',
    'id, title, production_type, content_type, destination, status, stage, metrics, script, created_at',
    'id, title, production_type, status, script, caption, created_at',
    'id, title, production_type, status, script, created_at',
  ];

  let lastError = '';
  for (const cols of selectAttempts) {
    const { data, error } = await admin
      .from('marketing_content')
      .select(cols)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      lastError = error.message ?? '';
      if (/column|schema cache|does not exist/i.test(lastError)) continue;
      return { ok: false, error: lastError };
    }

    const items = (data ?? [])
      .map((row) => mapMarketingContentRowToPipelineItem(asRecord(row)))
      .filter((x): x is MarketingPipelineItem => Boolean(x));

    return { ok: true, items };
  }

  return { ok: false, error: lastError || 'تعذر قراءة marketing_content.' };
}
