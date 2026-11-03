-- Preferred group trip from direct registration links (?tripId=)
-- Run in Supabase SQL Editor

alter table public.leads
  add column if not exists preferred_trip_id uuid references public.group_trips (id) on delete set null;

comment on column public.leads.preferred_trip_id is
  'Group trip selected via direct registration link /group-onboarding?tripId=';

create index if not exists leads_preferred_trip_id_idx
  on public.leads (preferred_trip_id)
  where preferred_trip_id is not null;
