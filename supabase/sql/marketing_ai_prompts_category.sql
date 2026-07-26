-- تصنيف المحتوى التسويقي — عمود category للفلاتر (قروبات، بيع الشعور، …)
alter table if exists public.marketing_ai_prompts
  add column if not exists category text;

alter table if exists public.marketing_ai_prompts
  add column if not exists content_category text;

-- مزامنة من content_category إن وُجد، وإلا من القيم القديمة
update public.marketing_ai_prompts
set category = coalesce(
  nullif(trim(category), ''),
  nullif(trim(content_category), ''),
  'أخرى'
)
where category is null or trim(category) = '';

update public.marketing_ai_prompts
set content_category = coalesce(nullif(trim(content_category), ''), category)
where content_category is null or trim(content_category) = '';

comment on column public.marketing_ai_prompts.category is 'تصنيف الفلتر في CRM — قروبات، بيع الشعور، حياة المدينة، طبيعة، أخرى';
