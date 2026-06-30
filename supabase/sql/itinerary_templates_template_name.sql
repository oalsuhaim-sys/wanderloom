-- عمود template_name (مطلوب في بعض مخططات Supabase)
alter table if exists public.itinerary_templates
  add column if not exists template_name text;

update public.itinerary_templates
set template_name = coalesce(nullif(trim(template_name), ''), nullif(trim(title), ''), 'قالب VIP')
where template_name is null or trim(template_name) = '';

alter table if exists public.itinerary_templates
  alter column template_name set not null;

comment on column public.itinerary_templates.template_name is 'اسم القالب المعروض في CRM — يُدخل من حقل «حفظ كقالب»';
