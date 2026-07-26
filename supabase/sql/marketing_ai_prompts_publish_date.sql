-- مواعيد النشر لرادار التسويق (Marketing Publishing Radar)
alter table if exists public.marketing_ai_prompts
  add column if not exists publish_date date;

alter table if exists public.marketing_ai_prompts
  add column if not exists publish_time time not null default '12:00';

alter table if exists public.marketing_ai_prompts
  add column if not exists content_category text;

comment on column public.marketing_ai_prompts.publish_date is 'تاريخ النشر المجدول — رادار النشر التسويقي';
comment on column public.marketing_ai_prompts.publish_time is 'وقت النشر المجدول';
comment on column public.marketing_ai_prompts.content_category is 'تصنيف المحتوى (بديل/مزامنة مع category)';

update public.marketing_ai_prompts
set content_category = coalesce(nullif(trim(content_category), ''), category)
where content_category is null or trim(content_category) = '';
