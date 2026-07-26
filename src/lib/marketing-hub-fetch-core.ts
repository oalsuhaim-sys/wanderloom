import type { SupabaseClient } from '@supabase/supabase-js';

import {
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

  const errors = [aiRes.error, humanRes.error, calendarRes.error, brandRes.error].filter(
    Boolean,
  );
  const loadError = errors.length ? errors.map((e) => e?.message).join(' · ') : null;

  const mappedAi = ((aiRes.data ?? []) as MarketingAiPromptRow[]).map(mapAiRow);

  return {
    aiItems: mappedAi,
    humanGuides: ((humanRes.data ?? []) as MarketingHumanScriptRow[]).map(mapHumanRow),
    calendarItems: ((calendarRes.data ?? []) as MarketingCalendarRow[]).map(mapCalendarRow),
    brandIdentity: mapBrandRow((brandRes.data as BrandIdentityRow | null) ?? null),
    loadError,
  };
}
