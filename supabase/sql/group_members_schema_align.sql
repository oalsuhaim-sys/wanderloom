-- Align group_members with production schema used by CRM approve flow.
-- Safe to re-run. Prefer group_id as the trip FK; keep group_trip_id as optional mirror.

alter table public.group_members
  add column if not exists group_id uuid references public.group_trips (id) on delete set null;

alter table public.group_members
  add column if not exists group_trip_id uuid references public.group_trips (id) on delete set null;

alter table public.group_members
  add column if not exists customer_name text;

alter table public.group_members
  add column if not exists customer_phone text;

alter table public.group_members
  add column if not exists payment_status text;

alter table public.group_members
  add column if not exists payment_deadline timestamptz;

-- Backfill group_id from group_trip_id (and vice versa) when one side is missing
update public.group_members
set group_id = group_trip_id
where group_id is null and group_trip_id is not null;

update public.group_members
set group_trip_id = group_id
where group_trip_id is null and group_id is not null;

create index if not exists group_members_group_id_idx
  on public.group_members (group_id)
  where group_id is not null;

comment on column public.group_members.group_id is
  'FK → group_trips.id (canonical in production)';
comment on column public.group_members.group_trip_id is
  'Legacy/alternate FK → group_trips.id (kept for older code paths)';
comment on column public.group_members.customer_name is
  'Denormalized guest name (may be NOT NULL in some environments)';
comment on column public.group_members.customer_phone is
  'Denormalized guest phone digits';
