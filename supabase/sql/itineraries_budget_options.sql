-- خيارات الميزانية المرنة (أسعار إجمالية حسب الفئة + بيانات أيام قد تحتوي فنادق بديلة في days_data)
alter table public.itineraries
  add column if not exists budget_options jsonb not null default '{}'::jsonb;

comment on column public.itineraries.budget_options is 'مثال: {"economy_total":5000,"standard_total":6500,"luxury_total":8000,"currency":"SAR"}';
