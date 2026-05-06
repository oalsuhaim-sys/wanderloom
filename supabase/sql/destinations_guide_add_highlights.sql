-- حقل «أبرز المعالم والأنشطة» لدليل الوجهات
-- نفّذ بعد destinations_guide.sql

alter table public.destinations_guide
  add column if not exists highlights text default '';

comment on column public.destinations_guide.highlights is 'قائمة سريعة بأبرز المعالم والأنشطة للموظف';
