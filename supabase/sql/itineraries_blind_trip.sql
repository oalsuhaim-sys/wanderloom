-- رحلة عمياء: إخفاء الوجهة والفنادق والخرائط حتى تاريخ الكشف

alter table public.itineraries
  add column if not exists is_blind boolean not null default false;

alter table public.itineraries
  add column if not exists reveal_date date;

comment on column public.itineraries.is_blind is 'عند true يُخفى اسم الوجهة والفنادق والروابط حتى reveal_date';
comment on column public.itineraries.reveal_date is 'أول يوم يُعرض فيه البرنامج كاملاً للعميل (تقويم محلي)';
