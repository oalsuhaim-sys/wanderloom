-- Align group_members.group_id with group_trips.id (int8).
-- Only needed if group_id was previously uuid/text.
-- Skip if you already altered the column manually.

alter table if exists public.group_members
  drop constraint if exists group_members_group_id_fkey;

alter table if exists public.group_members
  drop constraint if exists group_members_group_trip_id_fkey;

alter table if exists public.group_members
  alter column group_id type bigint using nullif(group_id::text, '')::bigint;

alter table if exists public.group_members
  alter column group_trip_id type bigint using nullif(group_trip_id::text, '')::bigint;

alter table if exists public.group_members
  add constraint group_members_group_id_fkey
  foreign key (group_id) references public.group_trips (id) on delete set null;

comment on column public.group_members.group_id is
  'FK → group_trips.id (int8)';
