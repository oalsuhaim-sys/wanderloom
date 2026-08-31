-- Branch / district label + direct map link for multi-location venues (e.g. Cafe Onion Seongsu)
alter table public.places
  add column if not exists branch_name text;

alter table public.places
  add column if not exists map_url text;

comment on column public.places.branch_name is
  'اسم الفرع / المنطقة — يميّز فروع نفس العلامة (مثل فرع سيونغسو)';

comment on column public.places.map_url is
  'رابط خريطة مباشر (Google Maps / Naver Map) — يُفضَّل على البحث النصي العام';
