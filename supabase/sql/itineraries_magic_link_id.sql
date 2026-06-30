-- عمود الرابط السحري للعميل (يُستخدم في /itinerary/[magic_link_id])
alter table public.itineraries
  add column if not exists magic_link_id uuid unique default gen_random_uuid();

comment on column public.itineraries.magic_link_id is 'Public share token for /itinerary/[magic_link_id]';
