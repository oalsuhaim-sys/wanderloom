-- حقول لوحة العميل VIP في الرابط السحري
alter table public.itineraries
  add column if not exists destination text;

alter table public.itineraries
  add column if not exists local_lingo jsonb default '[]'::jsonb;

comment on column public.itineraries.destination is 'نص الوجهة لخريطة Google في /itinerary/[magic_id]';
comment on column public.itineraries.local_lingo is 'مصفوفة {arabic, local} لقسم تحدث كالمحليين';
