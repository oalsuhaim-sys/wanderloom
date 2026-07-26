import { marketingSupabase } from '@/lib/marketing-supabase-client';
import {
  marketingFullText,
  marketingLongestCaptionFromRow,
  marketingLongestPromptFromRow,
} from '@/lib/marketing-prompt-text';

export type MarketingProductionType = 'ai' | 'human';

export const MARKETING_CONTENT_CATEGORIES = [
  'بيع الشعور',
  'قروبات',
  'حياة المدينة',
  'طبيعة',
  'أخرى',
] as const;

export type MarketingContentCategory = (typeof MARKETING_CONTENT_CATEGORIES)[number];

export const MARKETING_MEDIA_TYPES = ['فيديو', 'صورة'] as const;

export type MarketingMediaType = (typeof MARKETING_MEDIA_TYPES)[number];

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

export const MARKETING_AI_PROMPT_SELECT = '*';

export type MarketingContentItem = {
  id: string;
  title: string;
  productionType: MarketingProductionType;
  mediaType: MarketingMediaType;
  contentCategory: MarketingContentCategory;
  /** قيم خام من Supabase — للتصفية */
  media_type?: string;
  /** عمود category في marketing_ai_prompts */
  category?: string;
  content_category?: string;
  prompt: string;
  /** أطول نص برومبت من كل الأعمدة — للعرض المباشر */
  prompt_text?: string;
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
  const lower = trimmed.toLowerCase();
  if (lower === 'groups' || lower === 'group' || lower === 'قروب' || lower === 'قروبات') {
    return 'قروبات';
  }
  if (lower === 'selling' || lower === 'feeling' || lower.includes('شعور')) {
    return 'بيع الشعور';
  }
  if (lower === 'city' || lower.includes('مدينة')) {
    return 'حياة المدينة';
  }
  if (lower === 'nature' || lower.includes('طبيع')) {
    return 'طبيعة';
  }
  return 'أخرى';
}

/** تصنيف الصف من Supabase — `category` هو مصدر الحقيقة بعد إضافة العمود */
export function marketingRowCategory(row: {
  category?: string | null;
  content_category?: string | null;
}): MarketingContentCategory {
  return normalizeContentCategory(row.category ?? row.content_category);
}

export function marketingItemCategory(item: {
  category?: string;
  content_category?: string;
  contentCategory?: MarketingContentCategory;
}): MarketingContentCategory {
  return normalizeContentCategory(item.category ?? item.content_category ?? item.contentCategory);
}

/** تصنيف افتراضي من فلتر التبويب النشط (مثلاً قروبات عند فتح تبويب القروبات) */
export function marketingCategoryFromFilter(
  selectedCategory: string,
): MarketingContentCategory | undefined {
  const trimmed = selectedCategory.trim();
  if (!trimmed || trimmed === 'الكل') return undefined;
  return normalizeContentCategory(trimmed);
}

export function marketingMediaTypeFromFilter(
  selectedMediaType: string,
): MarketingMediaType | undefined {
  const trimmed = selectedMediaType.trim();
  if (!trimmed || trimmed === 'الكل') return undefined;
  return normalizeMediaType(trimmed);
}

export function mapMarketingContentRow(row: MarketingContentRow): MarketingContentItem {
  const raw = row as unknown as Record<string, unknown>;
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const normalizedCategory = marketingRowCategory({ content_category: row.content_category });
  const prompt = marketingLongestPromptFromRow(raw);
  return {
    id: row.id,
    title: row.title ?? '',
    productionType: row.production_type,
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizedCategory,
    media_type,
    category: normalizedCategory,
    content_category: normalizedCategory,
    prompt,
    prompt_text: prompt,
    script: marketingFullText(row.script),
    caption: marketingLongestCaptionFromRow(raw),
    videoUrl: marketingFullText(row.video_url),
    status: marketingFullText(row.status) || 'draft',
    dataSource: 'legacy_content',
  };
}

function marketingTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

function itemPromptText(item: MarketingContentItem): string {
  return item.prompt_text || item.prompt || '';
}

function itemCaptionText(item: MarketingContentItem): string {
  return item.caption || '';
}

function preferLongerText(current: string, candidate: string): string {
  if (!candidate.trim()) return current;
  if (!current.trim()) return candidate;
  return candidate.length > current.length ? candidate : current;
}

/** أطول برومبت لنفس الحملة عبر كل التصنيفات (يصلح قروبات ذات نص معاينة قصير). */
export function resolveMarketingCardPrompt(
  item: MarketingContentItem,
  pool: MarketingContentItem[],
): string {
  const titleKey = marketingTitleKey(item.title);
  let best = itemPromptText(item);
  for (const other of pool) {
    const sameCampaign =
      other.id === item.id || marketingTitleKey(other.title) === titleKey;
    if (!sameCampaign) continue;
    best = preferLongerText(best, itemPromptText(other));
  }
  return best;
}

/** أطول كابشن لنفس الحملة عبر كل التصنيفات. */
export function resolveMarketingCardCaption(
  item: MarketingContentItem,
  pool: MarketingContentItem[],
): string {
  const titleKey = marketingTitleKey(item.title);
  let best = itemCaptionText(item);
  for (const other of pool) {
    const sameCampaign =
      other.id === item.id || marketingTitleKey(other.title) === titleKey;
    if (!sameCampaign) continue;
    best = preferLongerText(best, itemCaptionText(other));
  }
  return best;
}

/** يطبّق أطول نصوص معروفة على كل بطاقة قبل دخولها للـ state. */
export function unifyMarketingContentItems(items: MarketingContentItem[]): MarketingContentItem[] {
  return items.map((item) => {
    const prompt = resolveMarketingCardPrompt(item, items);
    const caption = resolveMarketingCardCaption(item, items);
    if (prompt === itemPromptText(item) && caption === itemCaptionText(item)) {
      return item;
    }
    return { ...item, prompt, prompt_text: prompt, caption };
  });
}

/** تحويل صف marketing_ai_prompts إلى بطاقة الاستوديو */
export function mapAiPromptRowToContentItem(row: {
  id: string;
  category?: string | null;
  content_category?: string | null;
  media_type?: string | null;
  campaign_name?: string | null;
  campaign?: string | null;
  visual_prompt?: string | null;
  caption?: string | null;
  status?: string | null;
  prompt?: string | null;
  video_url?: string | null;
}): MarketingContentItem {
  const raw = row as Record<string, unknown>;
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const normalizedCategory = marketingRowCategory(row);
  const prompt = marketingLongestPromptFromRow(raw);
  return {
    id: row.id,
    title: String(row.campaign_name ?? row.campaign ?? '').trim() || 'حملة AI',
    productionType: 'ai',
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizedCategory,
    media_type,
    category: normalizedCategory,
    content_category: normalizedCategory,
    prompt,
    prompt_text: prompt,
    script: '',
    caption: marketingLongestCaptionFromRow(raw),
    videoUrl: marketingFullText(row.video_url),
    status: marketingFullText(row.status) || 'جاهز للتوليد',
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
  const aiRes = await marketingSupabase
    .from('marketing_ai_prompts')
    .select(MARKETING_AI_PROMPT_SELECT)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (aiRes.error) {
    return { ok: false, items: [], error: aiRes.error.message };
  }

  const aiItems = ((aiRes.data ?? []) as Parameters<typeof mapAiPromptRowToContentItem>[0][]).map(
    mapAiPromptRowToContentItem,
  );

  const humanItem = await ensureMarketingContentRow('human');
  const rawItems =
    humanItem.ok && humanItem.item ? [...aiItems, humanItem.item] : aiItems;

  return { ok: true, items: unifyMarketingContentItems(rawItems) };
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
        ...(patch.content_category != null
          ? { category: patch.content_category, content_category: patch.content_category }
          : {}),
        ...(patch.title != null ? { campaign_name: patch.title } : {}),
        ...(patch.prompt != null ? { visual_prompt: patch.prompt, prompt: patch.prompt } : {}),
        ...(patch.caption != null ? { caption: patch.caption } : {}),
        ...(patch.status != null ? { status: patch.status } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(MARKETING_AI_PROMPT_SELECT)
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
