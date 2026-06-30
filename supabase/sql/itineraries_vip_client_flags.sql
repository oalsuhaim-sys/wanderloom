-- أعلام واجهة العميل VIP وعروض الأسعار
alter table public.itineraries
  add column if not exists is_quotation boolean not null default false,
  add column if not exists is_medical boolean not null default false,
  add column if not exists show_fashion_services boolean not null default false;

comment on column public.itineraries.is_quotation is 'عرض سعر فاخر بدلاً من مسار حي';
comment on column public.itineraries.is_medical is 'رحلة طبية — قسم الكونسيرج الطبي';
comment on column public.itineraries.show_fashion_services is 'إظهار بطاقة الصالون/الأزياء للعميل';
