-- ربط الليدر/المؤثر المشرف برحلة القروب

alter table if exists public.group_trips
  add column if not exists leader_id bigint references public.clients (id) on delete set null;

alter table if exists public.group_trips
  add column if not exists leader_name text;

comment on column public.group_trips.leader_id is 'معرّف الليدر/المؤثر المشرف من جدول clients';
comment on column public.group_trips.leader_name is 'اسم الليدر المشرف (للعرض السريع بدون join)';

create index if not exists group_trips_leader_id_idx
  on public.group_trips (leader_id)
  where leader_id is not null;
