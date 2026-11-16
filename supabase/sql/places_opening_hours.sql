-- Opening hours cache for the places bank (from OpenStreetMap or typed by staff; auto hours refresh every 30 days).
-- Safe to run more than once. Adds columns only — nothing is changed or deleted.
alter table public.places add column if not exists opening_hours jsonb;
alter table public.places add column if not exists hours_synced_at timestamptz;
