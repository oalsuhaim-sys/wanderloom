import { marketingSupabase } from '@/lib/marketing-supabase-client';

export type MarketingProductionType = 'ai' | 'human';

export const MARKETING_CONTENT_CATEGORIES = [
  'بيع الشعور',
  'قروبات',
  'حياة المدينة',
  'طبيعة',
  'أخرى',
] as const;

export type MarketingContentCategory = (typeof MARKETING_CONTENT_CATEGORIES)[number];

export const MARKETING_CATEGORY_FILTER_ALL = 'الكل' as const;

export const MARKETING_MEDIA_TYPES = ['فيديو', 'صورة'] as const;

export type MarketingMediaType = (typeof MARKETING_MEDIA_TYPES)[number];

export const MARKETING_MEDIA_FILTER_ALL = 'الكل' as const;

export type MarketingContentRow = {
  id: string;
  title: string;
  production_type: MarketingProductionType;
  media_type: string | null;
  content_category: string | null;
  prompt: string;
  script: string;
  caption: string | null;
  video_url: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MarketingContentItem = {
  id: string;
  title: string;
  productionType: MarketingProductionType;
  mediaType: MarketingMediaType;
  contentCategory: MarketingContentCategory;
  /** قيم خام من Supabase — للتصفية */
  media_type?: string;
  content_category?: string;
  prompt: string;
  script: string;
  caption: string;
  videoUrl: string;
  status: string;
  dataSource: 'ai_prompt' | 'legacy_content';
};

export function normalizeMediaType(value: string | null | undefined): MarketingMediaType {
  const trimmed = String(value ?? '').trim();
  if ((MARKETING_MEDIA_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed as MarketingMediaType;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'image' || lower === 'photo' || lower === 'picture' || lower === 'صوره') {
    return 'صورة';
  }
  if (lower === 'video' || lower === 'reel' || lower === 'فيديو') {
    return 'فيديو';
  }
  return 'فيديو';
}

export function normalizeContentCategory(value: string | null | undefined): MarketingContentCategory {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'أخرى';
  if ((MARKETING_CONTENT_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as MarketingContentCategory;
  }
  return 'أخرى';
}

export function mapMarketingContentRow(row: MarketingContentRow): MarketingContentItem {
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const content_category = String(row.content_category ?? '').trim() || 'عام';
  return {
    id: row.id,
    title: row.title ?? '',
    productionType: row.production_type,
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizeContentCategory(row.content_category),
    media_type,
    content_category,
    prompt: row.prompt ?? '',
    script: row.script ?? '',
    caption: row.caption ?? '',
    videoUrl: row.video_url ?? '',
    status: row.status ?? 'draft',
    dataSource: 'legacy_content',
  };
}

/** تحويل صف marketing_ai_prompts إلى بطاقة الاستوديو */
export function mapAiPromptRowToContentItem(row: {
  id: string;
  category?: string | null;
  content_category?: string | null;
  media_type?: string | null;
  campaign?: string | null;
  visual_prompt?: string | null;
  caption?: string | null;
  status?: string | null;
}): MarketingContentItem {
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const content_category = String(row.content_category ?? row.category ?? '').trim() || 'عام';
  return {
    id: row.id,
    title: String(row.campaign ?? '').trim() || 'حملة AI',
    productionType: 'ai',
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizeContentCategory(row.content_category ?? row.category),
    media_type,
    content_category,
    prompt: String(row.visual_prompt ?? ''),
    script: '',
    caption: String(row.caption ?? ''),
    videoUrl: '',
    status: String(row.status ?? 'جاهز للتوليد'),
    dataSource: 'ai_prompt',
  };
}

export async function fetchMarketingContentByType(
  productionType: MarketingProductionType,
): Promise<{ ok: boolean; item: MarketingContentItem | null; error?: string }> {
  const { data, error } = await marketingSupabase
    .from('marketing_content')
    .select('*')
    .eq('production_type', productionType)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, item: null, error: error.message };
  }

  if (!data) {
    return { ok: true, item: null };
  }

  return { ok: true, item: mapMarketingContentRow(data as MarketingContentRow) };
}

export async function ensureMarketingContentRow(
  productionType: MarketingProductionType,
): Promise<{ ok: boolean; item: MarketingContentItem | null; error?: string }> {
  const existing = await fetchMarketingContentByType(productionType);
  if (!existing.ok) return existing;
  if (existing.item) return existing;

  const title = productionType === 'ai' ? 'الذكاء الاصطناعي' : 'الإنتاج البشري';
  const status = productionType === 'ai' ? 'جاهز للتوليد' : 'بانتظار التصوير';

  const { data, error } = await marketingSupabase
    .from('marketing_content')
    .insert({
      title,
      production_type: productionType,
      media_type: 'فيديو',
      prompt: '',
      script: '',
      status,
      sort_order: productionType === 'ai' ? 0 : 1,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, item: null, error: error?.message ?? 'تعذّر إنشاء سجل المحتوى' };
  }

  return { ok: true, item: mapMarketingContentRow(data as MarketingContentRow) };
}

export async function fetchAllMarketingContent(): Promise<{
  ok: boolean;
  items: MarketingContentItem[];
  error?: string;
}> {
  const { data, error } = await marketingSupabase
    .from('marketing_ai_prompts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return { ok: false, items: [], error: error.message };
  }

  const aiItems = ((data ?? []) as Parameters<typeof mapAiPromptRowToContentItem>[0][]).map(
    mapAiPromptRowToContentItem,
  );

  const humanItem = await ensureMarketingContentRow('human');
  const items = humanItem.ok && humanItem.item ? [...aiItems, humanItem.item] : aiItems;

  return { ok: true, items };
}

export async function updateMarketingContent(
  id: string,
  patch: Partial<{
    title: string;
    media_type: string;
    content_category: string;
    prompt: string;
    script: string;
    caption: string;
    video_url: string | null;
    status: string;
  }>,
  options?: { dataSource?: MarketingContentItem['dataSource'] },
): Promise<{ ok: boolean; item: MarketingContentItem | null; error?: string }> {
  if (options?.dataSource === 'ai_prompt') {
    const { data, error } = await marketingSupabase
      .from('marketing_ai_prompts')
      .update({
        ...(patch.media_type != null ? { media_type: patch.media_type } : {}),
        ...(patch.content_category != null ? { category: patch.content_category } : {}),
        ...(patch.prompt != null ? { visual_prompt: patch.prompt } : {}),
        ...(patch.caption != null ? { caption: patch.caption } : {}),
        ...(patch.status != null ? { status: patch.status } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, category, media_type, campaign, visual_prompt, caption, hashtags, status, sort_order')
      .single();

    if (error || !data) {
      return { ok: false, item: null, error: error?.message ?? 'تعذّر حفظ المحتوى' };
    }

    return { ok: true, item: mapAiPromptRowToContentItem(data) };
  }

  const { data, error } = await marketingSupabase
    .from('marketing_content')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, item: null, error: error?.message ?? 'تعذّر حفظ المحتوى' };
  }

  return { ok: true, item: mapMarketingContentRow(data as MarketingContentRow) };
}
