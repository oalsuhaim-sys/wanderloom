-- «زرت المكان ✓»: the client marks each stop of their itinerary as visited; staff see it in the CRM editor.
-- Safe to run more than once. Adds one column only — nothing is changed or deleted.
alter table public.itinerary_stop_ratings add column if not exists visited_at timestamptz;
