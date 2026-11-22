-- Client ratings (1–5 stars) for each stop of their itinerary.
-- Written only by the server (service role); staff can read them in the CRM.
-- Safe to run more than once. Creates a new table only — nothing existing is changed.
create table if not exists public.itinerary_stop_ratings (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null,
  day_index integer not null,
  stop_key text not null,
  places_bank_id uuid,
  place_name text,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (itinerary_id, day_index, stop_key)
);

create index if not exists itinerary_stop_ratings_itinerary_idx on public.itinerary_stop_ratings (itinerary_id);
create index if not exists itinerary_stop_ratings_place_idx on public.itinerary_stop_ratings (places_bank_id);

alter table public.itinerary_stop_ratings enable row level security;

drop policy if exists "staff read stop ratings" on public.itinerary_stop_ratings;
create policy "staff read stop ratings" on public.itinerary_stop_ratings
  for select using (public.is_crm_staff());
