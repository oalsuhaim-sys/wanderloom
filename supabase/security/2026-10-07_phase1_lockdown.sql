-- =====================================================================
-- Wanderloom — Security Phase 1 (wave 1): close public access
-- Date: 2026-10-07
--
-- What this does
--   1. Adds is_staff() / is_admin_staff() helpers (based on public.employees).
--   2. On EVERY table in schema public: drops all existing policies,
--      enables RLS, revokes all privileges from `anon`, and gives logged-in
--      staff full access through is_staff() (instead of "any signed-in user").
--   3. Re-grants to `anon` ONLY what the public pages still use today
--      (portal / itinerary / onboarding / checkout). Wave 2 (frontend moves
--      these reads to the server) will remove most of these.
--   4. Hides sensitive columns from anon on hotels / experts / leaders
--      (contacts, IBAN, balances) using column-level grants.
--   5. Fixes the advisor findings: SECURITY DEFINER views, mutable
--      search_path, anon-executable get_or_create_client_id.
--
-- Rollback: 2026-10-07_phase1_rollback.sql (restores policies, RLS flags and
-- anon grants exactly as they were before this file ran).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
      and coalesce(e.is_suspended, false) = false
  );
$$;

create or replace function public.is_admin_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees e
    where e.user_id = auth.uid()
      and coalesce(e.is_suspended, false) = false
      and (coalesce(e.is_admin, false) or e.role = 'Admin')
  );
$$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin_staff() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Reset every table: drop policies, enable RLS, revoke anon, staff-only
-- ---------------------------------------------------------------------
do $$
declare
  t record;
  p record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t.relname
    loop
      execute format('drop policy %I on public.%I', p.policyname, t.relname);
    end loop;

    execute format('alter table public.%I enable row level security', t.relname);
    execute format('revoke all on table public.%I from anon', t.relname);

    if t.relname <> 'employees' then
      execute format(
        'create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
        t.relname);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. employees: own row for any signed-in user, all rows for staff,
--    writes for admins only (closes the "make myself admin" hole)
-- ---------------------------------------------------------------------
create policy employees_select_own on public.employees
  for select to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy employees_select_staff on public.employees
  for select to authenticated using (public.is_staff());
create policy employees_admin_insert on public.employees
  for insert to authenticated with check (public.is_admin_staff());
create policy employees_admin_update on public.employees
  for update to authenticated using (public.is_admin_staff()) with check (public.is_admin_staff());
create policy employees_admin_delete on public.employees
  for delete to authenticated using (public.is_admin_staff());

-- ---------------------------------------------------------------------
-- 4. What the public site still needs (wave 1 — temporary where noted)
-- ---------------------------------------------------------------------

-- Public catalogue (read-only, intended to be public)
grant select on public.group_trips, public.tour_groups, public.sessions,
                public.countries, public.places
  to anon;
create policy anon_read on public.group_trips for select to anon using (true);
create policy anon_read on public.tour_groups for select to anon using (true);
create policy anon_read on public.sessions    for select to anon using (true);
create policy anon_read on public.countries   for select to anon using (true);
create policy anon_read on public.places      for select to anon using (true);

-- Session sign-up and itinerary change requests: write-only
grant insert on public.session_registrations, public.edit_requests to anon;
create policy anon_insert on public.session_registrations for insert to anon with check (true);
create policy anon_insert on public.edit_requests         for insert to anon with check (true);

-- Client-facing flows (portal, itinerary, onboarding, checkout).
-- TEMPORARY: wave 2 moves these to server routes, then these grants go.
-- No DELETE for anyone anonymous any more.
grant select, insert, update on public.clients, public.itineraries,
                                public.leads, public.client_preferences
  to anon;
create policy anon_read   on public.clients for select to anon using (true);
create policy anon_insert on public.clients for insert to anon with check (true);
create policy anon_update on public.clients for update to anon using (true) with check (true);

create policy anon_read   on public.itineraries for select to anon using (true);
create policy anon_insert on public.itineraries for insert to anon with check (true);
create policy anon_update on public.itineraries for update to anon using (true) with check (true);

create policy anon_read   on public.leads for select to anon using (true);
create policy anon_insert on public.leads for insert to anon with check (true);
create policy anon_update on public.leads for update to anon using (true) with check (true);

create policy anon_read   on public.client_preferences for select to anon using (true);
create policy anon_insert on public.client_preferences for insert to anon with check (true);
create policy anon_update on public.client_preferences for update to anon using (true) with check (true);

grant select on public.itinerary_days, public.itinerary_stops,
                public.group_members, public.wallet_transactions
  to anon;
create policy anon_read on public.itinerary_days      for select to anon using (true);
create policy anon_read on public.itinerary_stops     for select to anon using (true);
create policy anon_read on public.group_members       for select to anon using (true);
create policy anon_read on public.wallet_transactions for select to anon using (true);

grant select, insert on public.client_memories to anon;
create policy anon_read   on public.client_memories for select to anon using (true);
create policy anon_insert on public.client_memories for insert to anon with check (true);

-- Trip budget: only lines marked visible to the client
grant select on public.trip_budget to anon;
create policy anon_read_visible on public.trip_budget
  for select to anon using (coalesce(show_to_client, false));

-- ---------------------------------------------------------------------
-- 5. Column-level: public pages may read names, never contacts/IBAN/money
-- ---------------------------------------------------------------------
grant select (id, name, country, city, category) on public.hotels to anon;
create policy anon_read on public.hotels for select to anon using (true);

grant select (id, name) on public.experts to anon;
create policy anon_read on public.experts for select to anon using (true);

grant select (id, name, languages, destinations, experience_years) on public.leaders to anon;
create policy anon_read on public.leaders for select to anon using (true);

-- ---------------------------------------------------------------------
-- 6. Advisor fixes
-- ---------------------------------------------------------------------
alter view public.distinct_countries  set (security_invoker = true);
alter view public.distinct_cities     set (security_invoker = true);
alter view public.global_destinations set (security_invoker = true);

revoke execute on function public.get_or_create_client_id(text, text) from public, anon, authenticated;

alter function public.update_timestamp()          set search_path = public;
alter function public.update_updated_at()         set search_path = public;
alter function public.check_trip_anniversaries()  set search_path = public;
alter function public.get_or_create_client_id(text, text) set search_path = public;

commit;
