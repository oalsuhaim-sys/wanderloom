-- عروض الأسعار — تفاصيل تقديرية للفنادق والطيران ورسوم الخدمة
alter table public.itineraries
  add column if not exists quotation_details jsonb;

comment on column public.itineraries.quotation_details is
  'JSON: { enabled, hotels_estimate, flights_estimate, service_fee } — وضع عرض السعر في CRM';
