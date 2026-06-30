-- أقسام إضافية لمنشئ عروض الأسعار + حقول الهامش والإجمالي
alter table if exists public.quotations
  add column if not exists activities_proposals jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists transport_proposals jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists profit_margin numeric(5, 2) not null default 20;

alter table if exists public.quotations
  add column if not exists service_fee numeric(12, 2) not null default 0;

alter table if exists public.quotations
  add column if not exists grand_total numeric(12, 2) not null default 0;

comment on column public.quotations.activities_proposals is '[{ id, name, description, price }]';
comment on column public.quotations.transport_proposals is '[{ id, description, mode, price }]';
comment on column public.quotations.profit_margin is 'نسبة الربح %';
comment on column public.quotations.service_fee is 'رسوم خدمة Wanderloom';
comment on column public.quotations.grand_total is 'الإجمالي للعميل (محسوب)';
