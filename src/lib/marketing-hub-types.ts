/** أنواع وتحويلات مركز التسويق — مصدر الحقيقة للـ UI */

import {
  marketingItemCategory,
  marketingRowCategory,
  normalizeContentCategory,
  normalizeMediaType,
  type MarketingContentCategory,
  type MarketingContentRow,
  type MarketingMediaType,
} from '@/lib/marketing-content';
import {
  marketingFullText,
  marketingLongestCaptionFromRow,
  marketingLongestPromptFromRow,
} from '@/lib/marketing-prompt-text';

export type { MarketingContentCategory, MarketingMediaType };

export type AiContentItem = {
  id: string;
  mediaType: MarketingMediaType;
  contentCategory: MarketingContentCategory;
  media_type?: string;
  category?: string;
  content_category?: string;
  campaign: string;
  visualPrompt: string;
  caption: string;
  hashtags: string;
  status: string;
};

export type HumanProductionGuide = {
  id: string;
  title: string;
  hook: string;
  shotList: string[];
  voiceover: string;
  platform: string;
  carouselStructure: string;
  status: string;
};

export type ContentCalendarItem = {
  id: string;
  date: string;
  topic: string;
  format: string;
  platform: string;
};

export type BrandIdentity = {
  id: string;
  slogan: string;
  scarfPromptRule: string;
  designRules: string;
};

export type MarketingHubData = {
  aiItems: AiContentItem[];
  humanGuides: HumanProductionGuide[];
  calendarItems: ContentCalendarItem[];
  brandIdentity: BrandIdentity;
  loadError: string | null;
};

export const DEFAULT_BRAND_IDENTITY: Omit<BrandIdentity, 'id'> = {
  slogan: 'واندرلوم: تفصيل لا تنظيم',
  scarfPromptRule:
    'featuring a prominent custom luxury branded silk scarf integrated elegantly into the shot, quiet luxury aesthetic, highly detailed, cinematic lighting',
  designRules:
    'الخلفية: #FDFBF7 · النص: #111111 · Royal Olive: #1e3f20 · Gold: #cda04c · خط Tajawal · أسلوب Quiet Luxury — مساحات بيضاء، ظلال ناعمة، بدون ازدحام بصري.',
};

export type MarketingAiPromptRow = {
  id: string;
  category: string;
  content_category?: string | null;
  media_type: string | null;
  campaign_name?: string | null;
  /** @deprecated استخدم campaign_name */
  campaign?: string | null;
  visual_prompt: string;
  caption: string;
  hashtags: string;
  status: string;
  sort_order: number;
};

export type MarketingHumanScriptRow = {
  id: string;
  title: string;
  platform: string;
  hook: string;
  shot_list: string[] | null;
  voiceover_script: string;
  carousel_structure: string | null;
  status: string;
  sort_order: number;
};

export type MarketingCalendarRow = {
  id: string;
  month_week: string;
  topic: string;
  format: string;
  platform: string;
  sort_order: number;
};

export type BrandIdentityRow = {
  id: string;
  slug: string;
  slogan: string;
  ai_scarf_prompt_rule: string;
  brand_colors: string;
};

function safeStr(value: string | null | undefined): string {
  return marketingFullText(value);
}

function normalizeCategory(value: string | null | undefined): MarketingContentCategory {
  return normalizeContentCategory(value);
}

function hubCardKey(contentCategory: string, title: string): string {
  return `${contentCategory.trim()}::${title.trim()}`;
}

function preferLongerHubText(current: string, candidate: string): string {
  if (!candidate.trim()) return current;
  if (!current.trim()) return candidate;
  return candidate.length > current.length ? candidate : current;
}

/** دمج نصوص marketing_content القديمة (مثل قروبات) في بطاقات مصنع الـ AI */
export function mergeLegacyContentIntoAiItems(
  aiItems: AiContentItem[],
  legacyRows: MarketingContentRow[],
): AiContentItem[] {
  const legacyByKey = new Map<string, MarketingContentRow>();
  for (const row of legacyRows) {
    const title = marketingFullText(row.title).trim();
    const category = marketingFullText(row.content_category).trim();
    const prompt = marketingFullText(row.prompt).trim();
    if (!prompt) continue;
    if (title === 'الذكاء الاصطناعي' && category === 'أخرى') continue;
    legacyByKey.set(hubCardKey(category, title), row);
  }

  const merged = aiItems.map((item) => {
    const key = hubCardKey(item.content_category ?? '', item.campaign);
    const legacy = legacyByKey.get(key);
    if (!legacy) return item;

    return {
      ...item,
      visualPrompt: preferLongerHubText(item.visualPrompt, marketingFullText(legacy.prompt)),
      caption: preferLongerHubText(item.caption, marketingFullText(legacy.caption)),
    };
  });

  const existingKeys = new Set(
    merged.map((item) => hubCardKey(item.content_category ?? '', item.campaign)),
  );

  for (const [key, legacy] of legacyByKey) {
    if (existingKeys.has(key)) continue;
    const category = marketingFullText(legacy.content_category).trim();
    merged.push({
      id: legacy.id,
      mediaType: normalizeMediaType(legacy.media_type),
      contentCategory: normalizeCategory(category),
      media_type: marketingFullText(legacy.media_type).trim() || 'فيديو',
      content_category: category || 'عام',
      campaign: marketingFullText(legacy.title).trim() || 'حملة AI',
      visualPrompt: marketingFullText(legacy.prompt),
      caption: marketingFullText(legacy.caption),
      hashtags: '',
      status: marketingFullText(legacy.status) || 'جاهز للتوليد',
    });
  }

  return merged;
}

export function mapAiRow(row: MarketingAiPromptRow): AiContentItem {
  const raw = row as unknown as Record<string, unknown>;
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const normalizedCategory = marketingRowCategory(row);
  return {
    id: row.id,
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizedCategory,
    media_type,
    category: normalizedCategory,
    content_category: normalizedCategory,
    campaign: safeStr(row.campaign_name ?? row.campaign),
    visualPrompt: marketingLongestPromptFromRow(raw),
    caption: marketingLongestCaptionFromRow(raw),
    hashtags: safeStr(row.hashtags),
    status: safeStr(row.status),
  };
}

export function mapHumanRow(row: MarketingHumanScriptRow): HumanProductionGuide {
  return {
    id: row.id,
    title: safeStr(row.title),
    hook: safeStr(row.hook),
    shotList: (row.shot_list ?? []).map((s) => safeStr(s)).filter(Boolean),
    voiceover: safeStr(row.voiceover_script),
    platform: safeStr(row.platform),
    carouselStructure: safeStr(row.carousel_structure),
    status: safeStr(row.status),
  };
}

export function mapCalendarRow(row: MarketingCalendarRow): ContentCalendarItem {
  return {
    id: row.id,
    date: safeStr(row.month_week),
    topic: safeStr(row.topic),
    format: safeStr(row.format),
    platform: safeStr(row.platform),
  };
}

export function mapBrandRow(row: BrandIdentityRow | null): BrandIdentity {
  if (!row) {
    return { id: '', ...DEFAULT_BRAND_IDENTITY };
  }
  return {
    id: row.id,
    slogan: safeStr(row.slogan),
    scarfPromptRule: safeStr(row.ai_scarf_prompt_rule),
    designRules: safeStr(row.brand_colors),
  };
}

export function aiItemToInsert(data: Omit<AiContentItem, 'id'>) {
  const campaign = marketingFullText(data.campaign);
  const category = marketingFullText(data.category ?? data.content_category ?? data.contentCategory);
  return {
    category,
    content_category: category,
    media_type: data.media_type,
    campaign,
    campaign_name: campaign,
    visual_prompt: marketingFullText(data.visualPrompt),
    prompt: marketingFullText(data.visualPrompt),
    caption: marketingFullText(data.caption),
    hashtags: marketingFullText(data.hashtags),
    status: marketingFullText(data.status),
    updated_at: new Date().toISOString(),
  };
}

export function humanGuideToInsert(data: Omit<HumanProductionGuide, 'id'>) {
  return {
    title: data.title,
    platform: data.platform,
    hook: data.hook,
    shot_list: data.shotList,
    voiceover_script: data.voiceover,
    carousel_structure: data.carouselStructure,
    status: data.status,
    updated_at: new Date().toISOString(),
  };
}

export function calendarItemToInsert(data: Omit<ContentCalendarItem, 'id'>) {
  return {
    month_week: data.date,
    topic: data.topic,
    format: data.format,
    platform: data.platform,
    updated_at: new Date().toISOString(),
  };
}

export function brandIdentityToUpdate(data: Omit<BrandIdentity, 'id'>) {
  return {
    slogan: data.slogan,
    ai_scarf_prompt_rule: data.scarfPromptRule,
    brand_colors: data.designRules,
    updated_at: new Date().toISOString(),
  };
}
