-- وسوم DNA لجدول customers (طلبات الموقع) — نفّذ في SQL Editor إن لم يكن العمود موجوداً.
alter table public.customers
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.customers.tags is 'وسوم CRM سريعة (DNA سياحي)';

create index if not exists customers_tags_gin_idx on public.customers using gin (tags);
