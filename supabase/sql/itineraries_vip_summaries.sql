-- ملخصات تبويب الرئيسية لصفحة العميل VIP
alter table public.itineraries
  add column if not exists weather_summary text,
  add column if not exists packing_summary text,
  add column if not exists budget_summary text,
  add column if not exists flight_summary text;

comment on column public.itineraries.weather_summary is 'ملخص الطقس للعميل (VIP overview)';
comment on column public.itineraries.packing_summary is 'قائمة الحقيبة للعميل (VIP overview)';
comment on column public.itineraries.budget_summary is 'ملخص ميزانية نصي للعميل (ليس budget_options الداخلي)';
comment on column public.itineraries.flight_summary is 'ملخص البوردينق والطيران للعميل';
