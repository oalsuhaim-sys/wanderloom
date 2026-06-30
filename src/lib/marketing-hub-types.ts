/** أنواع وتحويلات مركز التسويق — مصدر الحقيقة للـ UI */

import {
  normalizeContentCategory,
  normalizeMediaType,
  type MarketingContentCategory,
  type MarketingMediaType,
} from '@/lib/marketing-content';

export type { MarketingContentCategory, MarketingMediaType };

export type AiContentItem = {
  id: string;
  mediaType: MarketingMediaType;
  contentCategory: MarketingContentCategory;
  media_type?: string;
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
  campaign: string;
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
  return value ?? '';
}

function normalizeCategory(value: string | null | undefined): MarketingContentCategory {
  return normalizeContentCategory(value);
}

export function mapAiRow(row: MarketingAiPromptRow): AiContentItem {
  const media_type = String(row.media_type ?? '').trim() || 'فيديو';
  const content_category = String(row.content_category ?? row.category ?? '').trim() || 'عام';
  return {
    id: row.id,
    mediaType: normalizeMediaType(row.media_type),
    contentCategory: normalizeCategory(row.content_category ?? row.category),
    media_type,
    content_category,
    campaign: safeStr(row.campaign),
    visualPrompt: safeStr(row.visual_prompt),
    caption: safeStr(row.caption),
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
  return {
    category: data.content_category,
    media_type: data.media_type,
    campaign: data.campaign,
    visual_prompt: data.visualPrompt,
    caption: data.caption,
    hashtags: data.hashtags,
    status: data.status,
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
