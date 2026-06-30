-- حقول عرض السعر: التكلفة التقديرية + رسوم الخدمة
alter table if exists public.itineraries
  add column if not exists total_estimated_cost numeric(12, 2) not null default 0;

comment on column public.itineraries.total_estimated_cost is 'التكلفة التقديرية للرحلة (طيران وفنادق) — عرض سعر';
comment on column public.itineraries.expected_profit is 'رسوم خدمة وإدارة Wanderloom (ر.س) — عرض سعر';
