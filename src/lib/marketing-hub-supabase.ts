'use client';

import { marketingSupabase } from '@/lib/marketing-supabase-client';
import {
  aiItemToInsert,
  brandIdentityToUpdate,
  calendarItemToInsert,
  humanGuideToInsert,
  mapAiRow,
  mapCalendarRow,
  mapHumanRow,
  type AiContentItem,
  type BrandIdentity,
  type ContentCalendarItem,
  type HumanProductionGuide,
  type MarketingAiPromptRow,
  type MarketingCalendarRow,
  type MarketingHumanScriptRow,
} from '@/lib/marketing-hub-types';

export type MarketingDbResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function client() {
  return marketingSupabase;
}

function wrapNetworkError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|fetch error/i.test(msg)) {
    return `تعذّر الاتصال بـ Supabase. جرّب زر «تحديث» أو تحقق من إعدادات Vercel و Supabase. (${msg})`;
  }
  return msg;
}

export async function createAiPromptLive(
  data: Omit<AiContentItem, 'id'>,
): Promise<MarketingDbResult<AiContentItem>> {
  const supabase = client();

  try {
    const { data: row, error } = await supabase
      .from('marketing_ai_prompts')
      .insert(aiItemToInsert(data) as never)
      .select('*')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapAiRow(row as MarketingAiPromptRow) };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function updateAiPromptLive(
  id: string,
  data: Omit<AiContentItem, 'id'>,
): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase
      .from('marketing_ai_prompts')
      .update(aiItemToInsert(data) as never)
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function deleteAiPromptLive(id: string): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase.from('marketing_ai_prompts').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function createHumanScriptLive(
  data: Omit<HumanProductionGuide, 'id'>,
): Promise<MarketingDbResult<HumanProductionGuide>> {
  const supabase = client();

  try {
    const { data: row, error } = await supabase
      .from('marketing_human_scripts')
      .insert(humanGuideToInsert(data) as never)
      .select(
        'id, title, platform, hook, shot_list, voiceover_script, carousel_structure, status, sort_order',
      )
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapHumanRow(row as MarketingHumanScriptRow) };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function updateHumanScriptLive(
  id: string,
  data: Omit<HumanProductionGuide, 'id'>,
): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase
      .from('marketing_human_scripts')
      .update(humanGuideToInsert(data) as never)
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function deleteHumanScriptLive(id: string): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase.from('marketing_human_scripts').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function createCalendarItemLive(
  data: Omit<ContentCalendarItem, 'id'>,
): Promise<MarketingDbResult<ContentCalendarItem>> {
  const supabase = client();

  try {
    const { data: row, error } = await supabase
      .from('marketing_calendar')
      .insert(calendarItemToInsert(data) as never)
      .select('id, month_week, topic, format, platform, sort_order')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: mapCalendarRow(row as MarketingCalendarRow) };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function updateCalendarItemLive(
  id: string,
  data: Omit<ContentCalendarItem, 'id'>,
): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase
      .from('marketing_calendar')
      .update(calendarItemToInsert(data) as never)
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function deleteCalendarItemLive(id: string): Promise<MarketingDbResult> {
  const supabase = client();

  try {
    const { error } = await supabase.from('marketing_calendar').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}

export async function updateBrandIdentityLive(
  id: string,
  data: Omit<BrandIdentity, 'id'>,
): Promise<MarketingDbResult> {
  const supabase = client();

  const payload = brandIdentityToUpdate(data);

  try {
    if (id) {
      const { error } = await supabase.from('brand_identity').update(payload as never).eq('id', id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from('brand_identity')
        .upsert({ slug: 'default', ...payload } as never, { onConflict: 'slug' });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrapNetworkError(err) };
  }
}
