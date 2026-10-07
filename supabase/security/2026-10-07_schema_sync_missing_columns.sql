-- =====================================================================
-- Wanderloom — schema sync: columns the app already queries but the live
-- database never received. APPLIED 2026-10-07 (migration schema_sync_missing_columns).
--
-- Types follow the LIVE database (uuid ids), not the older files in
-- supabase/sql/*.sql, which assume bigint ids and would fail on this project.
-- Purely additive: no data changed, no column removed. Verified in a
-- rolled-back dry run (7 checks) before applying.
--
-- Errors this removes (from Supabase logs 2026-10-06/07):
--   column leads.preferred_trip_id does not exist      (77x — CRM group radar)
--   column countries.sort_order does not exist         (42x — site country list)
--   column clients.intake_automated_at does not exist  (13x — website intake)
--   column group_trips.leader_id does not exist        (7x  — home page group cards)
--   column invoices.trip_title does not exist          (4x  — CRM pending invoices)
-- =====================================================================
alter table public.leads add column if not exists preferred_trip_id text;
comment on column public.leads.preferred_trip_id is 'Group trip chosen via /group-onboarding?tripId= (text: matches group_trips.id as sent by the app)';
create index if not exists leads_preferred_trip_id_idx on public.leads (preferred_trip_id) where preferred_trip_id is not null;

alter table public.leads add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists leads_client_id_idx on public.leads (client_id) where client_id is not null;

alter table public.clients
  add column if not exists intake_automated_at timestamptz,
  add column if not exists dna_link_sent_at timestamptz;

alter table public.group_trips
  add column if not exists leader_id uuid,
  add column if not exists leader_name text;

alter table public.countries add column if not exists sort_order integer not null default 0;

alter table public.invoices add column if not exists trip_title text not null default '';

-- Rollback (only if ever needed; drops the new columns and any values written to them):
-- alter table public.leads drop column if exists preferred_trip_id, drop column if exists client_id;
-- alter table public.clients drop column if exists intake_automated_at, drop column if exists dna_link_sent_at;
-- alter table public.group_trips drop column if exists leader_id, drop column if exists leader_name;
-- alter table public.countries drop column if exists sort_order;
-- alter table public.invoices drop column if exists trip_title;
