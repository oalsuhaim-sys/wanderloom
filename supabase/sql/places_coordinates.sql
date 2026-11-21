-- Exact map position of each place in the bank (used by the client itinerary map).
-- Safe to run more than once. Adds columns only — nothing is changed or deleted.
alter table public.places add column if not exists lat double precision;
alter table public.places add column if not exists lng double precision;
