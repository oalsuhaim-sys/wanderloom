-- ============================================================
-- Canonical tables: group_trips + group_members
-- Run AFTER existing group_trips.sql / capacity / registered_clients
-- ============================================================

-- Inventory counter on group_trips
alter table public.group_trips
  add column if not exists booked_seats integer not null default 0;

comment on column public.group_trips.booked_seats is
  'Confirmed seats count — incremented on confirmed_seat assignment';

update public.group_trips
set booked_seats = greatest(
  coalesce(cardinality(registered_client_ids), 0),
  coalesce(booked_seats, 0)
)
where true;

-- Pivot: clients joining a group trip (status / waitlist / seat)
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  client_id integer not null references public.clients (id) on delete cascade,
  group_trip_id uuid references public.group_trips (id) on delete set null,
  status text not null default 'pending_interview'
    check (
      status in (
        'pending_interview',
        'approved',
        'rejected',
        'confirmed_seat',
        'waitlisted'
      )
    ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_members_client_unique unique (client_id)
);

comment on table public.group_members is
  'SSOT pivot: client ↔ group_trips (interview → approve → seat / waitlist)';

create index if not exists group_members_status_idx
  on public.group_members (status);

create index if not exists group_members_trip_idx
  on public.group_members (group_trip_id)
  where group_trip_id is not null;

alter table public.group_members enable row level security;

drop policy if exists "group_members_crm_all" on public.group_members;
create policy "group_members_crm_all"
  on public.group_members for all
  to anon, authenticated
  using (true)
  with check (true);

-- Migrate legacy group_applications → group_members (no-op if already dropped)
do $$
begin
  if to_regclass('public.group_applications') is not null then
    insert into public.group_members (
      id, client_id, group_trip_id, status, notes, created_at, updated_at
    )
    select
      ga.id,
      ga.client_id,
      ga.group_trip_id,
      ga.status,
      ga.notes,
      ga.created_at,
      ga.updated_at
    from public.group_applications ga
    on conflict (client_id) do update set
      group_trip_id = excluded.group_trip_id,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = excluded.updated_at;
  end if;
end $$;

-- Optional DNA tagging on clients
alter table public.clients
  add column if not exists intake_trip_type text;

comment on column public.clients.intake_trip_type is
  'DNA invite trip type: private | group';
