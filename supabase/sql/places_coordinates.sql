-- Exact map position of each place in the bank (used by the client itinerary map).
-- geo_checked_at = when the place was last looked up automatically (so it is looked up once).
-- Safe to run more than once. Adds columns only — nothing is changed or deleted.
alter table public.places add column if not exists lat double precision;
alter table public.places add column if not exists lng double precision;
alter table public.places add column if not exists geo_checked_at timestamptz;
