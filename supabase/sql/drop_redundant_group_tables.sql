-- ============================================================
-- DROP redundant group tables (already dropped in production OK)
-- Canonical SSOT: public.group_trips + public.group_members
-- ============================================================

drop table if exists public.group_tours cascade;
drop table if exists public.group_travelers cascade;
drop table if exists public.group_applications cascade;
drop table if exists public.group_tour cascade;
drop table if exists public.group_traveler cascade;
drop table if exists public.group_registrations cascade;
