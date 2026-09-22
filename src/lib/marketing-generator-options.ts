import type { SupabaseClient } from '@supabase/supabase-js';

/** Fallback / Default Marketing Constants */
export const TARGET_AUDIENCES = [
  'مسافرون لأول مرة',
  'المجموعة النسائية',
  'عشاق الهدوء والتأمل',
] as const;

export const PRODUCTION_FORMATS = [
  'السرد الصوتي على الأرشيف',
  'المقارنة البصرية Split-Screen',
  'الاستوديو + الكتاب',
  'التفكيك المالي بالجرافيك',
  'POV الحسّي',
  'السلاسل التفاعلية',
] as const;

export const PLATFORMS = ['إنستقرام', 'يوتيوب', 'تيك توك / شورتس', 'منصة X'] as const;

export const DESTINATIONS = ['كوريا', 'اليابان', 'روسيا', 'أخرى'] as const;

export const PHILOSOPHY_PILLARS = [
  'تلقائي حسب الصيغة —',
  'بيع الشعور',
  'هندسة الهدوء',
] as const;

export const FUNNEL_STAGES = ['الوعي', 'الاهتمام', 'التحويل'] as const;

export type GeneratorOptionCategory =
  | 'audience'
  | 'format'
  | 'platform'
  | 'destination'
  | 'philosophy'
  | 'funnel_stage';

export type MarketingGeneratorOptions = {
  audiences: string[];
  formats: string[];
  platforms: string[];
  destinations: string[];
  philosophies: string[];
  funnelStages: string[];
  source: 'supabase' | 'fallback' | 'mixed';
};

export const FALLBACK_GENERATOR_OPTIONS: MarketingGeneratorOptions = {
  audiences: [...TARGET_AUDIENCES],
  formats: [...PRODUCTION_FORMATS],
  platforms: [...PLATFORMS],
  destinations: [...DESTINATIONS],
  philosophies: [...PHILOSOPHY_PILLARS],
  funnelStages: [...FUNNEL_STAGES],
  source: 'fallback',
};

function uniqPreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function mergeWithFallback(fetched: string[], fallback: readonly string[]): string[] {
  if (!fetched.length) return [...fallback];
  return uniqPreserveOrder([...fetched, ...fallback]);
}

type OptionRow = {
  category?: string | null;
  label?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

function groupOptionRows(rows: OptionRow[]): Partial<Record<GeneratorOptionCategory, string[]>> {
  const buckets: Partial<Record<GeneratorOptionCategory, { label: string; sort: number }[]>> = {};

  for (const row of rows) {
    const category = String(row.category ?? '').trim() as GeneratorOptionCategory;
    const label = String(row.label ?? '').trim();
    if (!label) continue;
    if (
      category !== 'audience' &&
      category !== 'format' &&
      category !== 'platform' &&
      category !== 'destination' &&
      category !== 'philosophy' &&
      category !== 'funnel_stage'
    ) {
      continue;
    }
    if (row.is_active === false) continue;
    const list = buckets[category] ?? [];
    list.push({ label, sort: Number(row.sort_order ?? 0) });
    buckets[category] = list;
  }

  const out: Partial<Record<GeneratorOptionCategory, string[]>> = {};
  for (const [key, list] of Object.entries(buckets) as [
    GeneratorOptionCategory,
    { label: string; sort: number }[],
  ][]) {
    out[key] = uniqPreserveOrder(
      [...list].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'ar')).map((x) => x.label),
    );
  }
  return out;
}

/**
 * Prefer `marketing_generator_options`; if missing/empty, fall back to constants
 * and optionally enrich from distinct values already stored on `marketing_content`.
 */
export async function resolveMarketingGeneratorOptions(
  client: SupabaseClient,
): Promise<MarketingGeneratorOptions> {
  let fromTable: Partial<Record<GeneratorOptionCategory, string[]>> = {};
  let tableOk = false;

  try {
    const { data, error } = await client
      .from('marketing_generator_options')
      .select('category, label, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error) {
      tableOk = true;
      fromTable = groupOptionRows((data ?? []) as OptionRow[]);
    }
  } catch {
    tableOk = false;
  }

  // Optional enrichment from existing content rows (never required)
  let fromContent: Partial<Record<GeneratorOptionCategory, string[]>> = {};
  try {
    const { data, error } = await client
      .from('marketing_content')
      .select('production_type, content_type, destination, target_audience, philosophy_pillar, funnel_stage')
      .limit(500);

    if (!error && data?.length) {
      const audiences: string[] = [];
      const formats: string[] = [];
      const platforms: string[] = [];
      const destinations: string[] = [];
      const philosophies: string[] = [];
      const funnelStages: string[] = [];

      for (const row of data as Record<string, unknown>[]) {
        const audience = String(row.target_audience ?? '').trim();
        const format = String(row.production_type ?? '').trim();
        const platform = String(row.content_type ?? '').trim();
        const destination = String(row.destination ?? '').trim();
        const philosophy = String(row.philosophy_pillar ?? '').trim();
        const funnel = String(row.funnel_stage ?? '').trim();

        if (audience) audiences.push(audience);
        if (format && format !== 'ai' && format !== 'human') formats.push(format);
        if (platform) platforms.push(platform);
        if (destination) destinations.push(destination);
        if (philosophy) philosophies.push(philosophy);
        if (funnel) funnelStages.push(funnel);
      }

      fromContent = {
        audience: uniqPreserveOrder(audiences),
        format: uniqPreserveOrder(formats),
        platform: uniqPreserveOrder(platforms),
        destination: uniqPreserveOrder(destinations),
        philosophy: uniqPreserveOrder(philosophies),
        funnel_stage: uniqPreserveOrder(funnelStages),
      };
    }
  } catch {
    /* ignore enrichment failures */
  }

  const audiences = mergeWithFallback(
    [...(fromTable.audience ?? []), ...(fromContent.audience ?? [])],
    TARGET_AUDIENCES,
  );
  const formats = mergeWithFallback(
    [...(fromTable.format ?? []), ...(fromContent.format ?? [])],
    PRODUCTION_FORMATS,
  );
  const platforms = mergeWithFallback(
    [...(fromTable.platform ?? []), ...(fromContent.platform ?? [])],
    PLATFORMS,
  );
  const destinations = mergeWithFallback(
    [...(fromTable.destination ?? []), ...(fromContent.destination ?? [])],
    DESTINATIONS,
  );
  const philosophies = mergeWithFallback(
    [...(fromTable.philosophy ?? []), ...(fromContent.philosophy ?? [])],
    PHILOSOPHY_PILLARS,
  );
  const funnelStages = mergeWithFallback(
    [...(fromTable.funnel_stage ?? []), ...(fromContent.funnel_stage ?? [])],
    FUNNEL_STAGES,
  );

  const usedTable =
    tableOk &&
    Boolean(
      fromTable.audience?.length ||
        fromTable.format?.length ||
        fromTable.platform?.length ||
        fromTable.destination?.length ||
        fromTable.philosophy?.length ||
        fromTable.funnel_stage?.length,
    );
  const usedContent = Boolean(
    fromContent.audience?.length ||
      fromContent.format?.length ||
      fromContent.platform?.length ||
      fromContent.destination?.length ||
      fromContent.philosophy?.length ||
      fromContent.funnel_stage?.length,
  );

  return {
    audiences,
    formats,
    platforms,
    destinations,
    philosophies,
    funnelStages,
    source: usedTable || usedContent ? (usedTable ? 'supabase' : 'mixed') : 'fallback',
  };
}
