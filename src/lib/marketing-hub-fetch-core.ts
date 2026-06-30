import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_BRAND_IDENTITY,
  mapAiRow,
  mapBrandRow,
  mapCalendarRow,
  mapHumanRow,
  type BrandIdentityRow,
  type MarketingAiPromptRow,
  type MarketingCalendarRow,
  type MarketingHubData,
  type MarketingHumanScriptRow,
} from '@/lib/marketing-hub-types';
function networkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|fetch error/i.test(msg)) {
    return `تعذّر الاتصال بـ Supabase (Failed to fetch). تحقق من: 1) المشروع غير موقوف في لوحة Supabase 2) متغيرات البيئة على Vercel 3) تنفيذ supabase/sql/marketing_hub.sql — (${msg})`;
  }
  return msg;
}

export async function queryMarketingHub(supabase: SupabaseClient): Promise<MarketingHubData> {
  const [aiRes, humanRes, calendarRes, brandRes] = await Promise.all([
    supabase
      .from('marketing_ai_prompts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('marketing_human_scripts')
      .select(
        'id, title, platform, hook, shot_list, voiceover_script, carousel_structure, status, sort_order',
      )
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('marketing_calendar')
      .select('id, month_week, topic, format, platform, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('brand_identity')
      .select('id, slug, slogan, ai_scarf_prompt_rule, brand_colors')
      .eq('slug', 'default')
      .maybeSingle(),
  ]);

  const errors = [aiRes.error, humanRes.error, calendarRes.error, brandRes.error].filter(Boolean);
  const loadError = errors.length ? errors.map((e) => e?.message).join(' · ') : null;

  return {
    aiItems: ((aiRes.data ?? []) as MarketingAiPromptRow[]).map(mapAiRow),
    humanGuides: ((humanRes.data ?? []) as MarketingHumanScriptRow[]).map(mapHumanRow),
    calendarItems: ((calendarRes.data ?? []) as MarketingCalendarRow[]).map(mapCalendarRow),
    brandIdentity: mapBrandRow((brandRes.data as BrandIdentityRow | null) ?? null),
    loadError,
  };
}

export async function fetchMarketingHubSafe(
  getClient: () => SupabaseClient,
): Promise<MarketingHubData> {
  const empty: MarketingHubData = {
    aiItems: [],
    humanGuides: [],
    calendarItems: [],
    brandIdentity: { id: '', ...DEFAULT_BRAND_IDENTITY },
    loadError: null,
  };

  try {
    return await queryMarketingHub(getClient());
  } catch (err) {
    return { ...empty, loadError: networkErrorMessage(err) };
  }
}
