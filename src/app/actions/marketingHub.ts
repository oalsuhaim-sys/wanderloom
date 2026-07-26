'use server';

import { revalidatePath } from 'next/cache';

import { createServerSupabase } from '@/lib/supabaseServer';
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

export type MarketingActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function dbError(message?: string): MarketingActionResult {
  return { ok: false, error: message || 'فشل الاتصال بقاعدة البيانات' };
}

function getSupabase() {
  return createServerSupabase();
}

function revalidateMarketing() {
  revalidatePath('/crm/marketing');
}

export async function createAiPromptAction(
  data: Omit<AiContentItem, 'id'>,
): Promise<MarketingActionResult<AiContentItem>> {
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('marketing_ai_prompts')
    .insert(aiItemToInsert(data) as never)
    .select('*')
    .single();

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true, data: mapAiRow(row as MarketingAiPromptRow) };
}

export async function updateAiPromptAction(
  id: string,
  data: Omit<AiContentItem, 'id'>,
): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('marketing_ai_prompts')
    .update(aiItemToInsert(data) as never)
    .eq('id', id);

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function deleteAiPromptAction(id: string): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase.from('marketing_ai_prompts').delete().eq('id', id);
  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function createHumanScriptAction(
  data: Omit<HumanProductionGuide, 'id'>,
): Promise<MarketingActionResult<HumanProductionGuide>> {
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('marketing_human_scripts')
    .insert(humanGuideToInsert(data) as never)
    .select(
      'id, title, platform, hook, shot_list, voiceover_script, carousel_structure, status, sort_order',
    )
    .single();

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true, data: mapHumanRow(row as MarketingHumanScriptRow) };
}

export async function updateHumanScriptAction(
  id: string,
  data: Omit<HumanProductionGuide, 'id'>,
): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('marketing_human_scripts')
    .update(humanGuideToInsert(data) as never)
    .eq('id', id);

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function deleteHumanScriptAction(id: string): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase.from('marketing_human_scripts').delete().eq('id', id);
  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function createCalendarItemAction(
  data: Omit<ContentCalendarItem, 'id'>,
): Promise<MarketingActionResult<ContentCalendarItem>> {
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('marketing_calendar')
    .insert(calendarItemToInsert(data) as never)
    .select('id, month_week, topic, format, platform, sort_order')
    .single();

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true, data: mapCalendarRow(row as MarketingCalendarRow) };
}

export async function updateCalendarItemAction(
  id: string,
  data: Omit<ContentCalendarItem, 'id'>,
): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('marketing_calendar')
    .update(calendarItemToInsert(data) as never)
    .eq('id', id);

  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function deleteCalendarItemAction(id: string): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const { error } = await supabase.from('marketing_calendar').delete().eq('id', id);
  if (error) return dbError(error.message);
  revalidateMarketing();
  return { ok: true };
}

export async function updateBrandIdentityAction(
  id: string,
  data: Omit<BrandIdentity, 'id'>,
): Promise<MarketingActionResult> {
  const supabase = getSupabase();

  const payload = brandIdentityToUpdate(data);

  if (id) {
    const { error } = await supabase.from('brand_identity').update(payload as never).eq('id', id);
    if (error) return dbError(error.message);
  } else {
    const { error } = await supabase
      .from('brand_identity')
      .upsert({ slug: 'default', ...payload } as never, { onConflict: 'slug' });
    if (error) return dbError(error.message);
  }

  revalidateMarketing();
  return { ok: true };
}
