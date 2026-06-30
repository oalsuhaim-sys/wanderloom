-- إرفاق بوتيك الأزياء في الرابط السحري (اختياري لكل مسار)
alter table public.itineraries
  add column if not exists include_wardrobe boolean not null default false;

comment on column public.itineraries.include_wardrobe is 'عند true يعرض قسم الأزياء في صفحة /itinerary/[magic_id]';
