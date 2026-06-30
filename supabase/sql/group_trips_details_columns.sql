-- حقول تفاصيل إضافية لرحلات القروبات (تواريخ، سعر، تشمل، لا تشمل)
alter table public.group_trips
  add column if not exists dates_ar text not null default '',
  add column if not exists dates_en text not null default '',
  add column if not exists price text not null default '',
  add column if not exists includes_ar text not null default '',
  add column if not exists includes_en text not null default '',
  add column if not exists excludes_ar text not null default '',
  add column if not exists excludes_en text not null default '';
