-- Ensure marketing prompt/caption columns store unlimited text (never varchar limits).
alter table if exists public.marketing_ai_prompts
  alter column visual_prompt type text using visual_prompt::text;

alter table if exists public.marketing_ai_prompts
  add column if not exists prompt text;

alter table if exists public.marketing_ai_prompts
  alter column caption type text using caption::text;

alter table if exists public.marketing_ai_prompts
  alter column hashtags type text using hashtags::text;

-- Code expects campaign_name; keep campaign in sync for legacy rows.
alter table if exists public.marketing_ai_prompts
  add column if not exists campaign_name text;

update public.marketing_ai_prompts
set campaign_name = coalesce(nullif(trim(campaign_name), ''), campaign)
where campaign_name is null or trim(campaign_name) = '';

-- Mirror full copy into prompt when only visual_prompt was populated
update public.marketing_ai_prompts
set prompt = visual_prompt
where (prompt is null or trim(prompt) = '')
  and visual_prompt is not null
  and trim(visual_prompt) <> '';
