-- وسوم موسم/وجهة موسّعة للمطابقة الذكية مع الرحلة (إلى جانب seasons / destinations)
alter table public.travel_wardrobe
  add column if not exists season_tags text[] not null default '{}';

alter table public.travel_wardrobe
  add column if not exists destination_tags text[] not null default '{}';

comment on column public.travel_wardrobe.season_tags is 'وسوم موسم إضافية، مثال: شتاء، طوال العام';
comment on column public.travel_wardrobe.destination_tags is 'وسوم وجهة/منطقة، مثال: كوريا، آسيا، سيول';
