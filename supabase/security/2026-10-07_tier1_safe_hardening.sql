-- =====================================================================
-- Wanderloom — Security Tier 1: zero-regression hardening
-- Date: 2026-10-07
--
-- Rule for this file: only remove what NO code path in the app uses as the
-- anonymous (anon) role. Verified against the repository: browser code,
-- server actions and route handlers that use the anon key.
--
-- Closes now:
--   * Anyone making themselves admin (anon INSERT/UPDATE/DELETE on employees)
--   * Anonymous deletion of clients, leads, groups, places, etc.
--     (kept only where the app itself deletes with the anon key:
--      itineraries, marketing_* tables, session_registrations, group_members)
--   * TRUNCATE / TRIGGER / REFERENCES privileges for anon (never needed)
--   * Hotel contacts (phone, email, manager, booking links, notes)
--   * Expert IBAN, phone, email, balances, commission rates
--   * Leader phone, email, balances, commission rates
--   * memory_vault and influencers fully closed to anon
--   * get_or_create_client_id no longer callable anonymously (unused)
--   * Advisor findings: SECURITY DEFINER views, mutable search_path
--
-- Logged-in staff (authenticated) are NOT affected by anything in this file.
-- Rollback: 2026-10-07_phase1_rollback.sql restores the exact prior state.
-- =====================================================================

begin;

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate, references, trigger on table public.%I from anon', t.relname);
    if t.relname not in ('itineraries', 'marketing_ai_prompts', 'marketing_calendar',
                         'marketing_human_scripts', 'session_registrations', 'group_members') then
      execute format('revoke delete on table public.%I from anon', t.relname);
    end if;
  end loop;
end $$;

-- employees: no anonymous writes
revoke insert, update, delete on table public.employees from anon;

-- Not used anonymously anywhere
revoke all on table public.memory_vault from anon;
revoke all on table public.influencers  from anon;

-- Column-level: names yes, contacts / IBAN / money no
revoke select on table public.hotels from anon;
grant  select (id, name, country, city, category) on public.hotels to anon;

revoke select on table public.experts from anon;
grant  select (id, name) on public.experts to anon;

revoke select on table public.leaders from anon;
grant  select (id, name, referral_code, status, languages, destinations, experience_years)
  on public.leaders to anon;

-- Unused SECURITY DEFINER function exposed to the public API
revoke execute on function public.get_or_create_client_id(text, text) from public, anon;

-- Advisor fixes
alter view public.distinct_countries  set (security_invoker = true);
alter view public.distinct_cities     set (security_invoker = true);
alter view public.global_destinations set (security_invoker = true);

alter function public.update_timestamp()                  set search_path = public;
alter function public.update_updated_at()                 set search_path = public;
alter function public.check_trip_anniversaries()          set search_path = public;
alter function public.get_or_create_client_id(text, text) set search_path = public;

commit;
