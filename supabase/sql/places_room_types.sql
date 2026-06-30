-- أنواع الغرف المرتبطة بكل فندق في بنك الأماكن
alter table if exists public.places
  add column if not exists room_types text[] not null default '{}';

comment on column public.places.room_types is 'أنواع الغرف المتاحة للفندق — تُستخدم في عروض الأسعار';
