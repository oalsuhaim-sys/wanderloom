-- CRM client profile enrichment (directory cards)
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table if exists public.clients
  add column if not exists lifetime_value numeric(14, 2) not null default 0;

alter table if exists public.clients
  add column if not exists engagement_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_engagement_status_check'
  ) then
    alter table public.clients
      add constraint clients_engagement_status_check
      check (
        engagement_status is null
        or engagement_status in ('active', 'warm', 'cold')
      );
  end if;
end $$;

comment on column public.clients.lifetime_value is
  'Customer lifetime value (CLV) in SAR — total spent across bookings.';
comment on column public.clients.engagement_status is
  'Engagement heat: active | warm | cold';

-- Backfill CLV from total_spent when lifetime_value is still zero
update public.clients
set lifetime_value = coalesce(total_spent, 0)
where coalesce(lifetime_value, 0) = 0
  and coalesce(total_spent, 0) > 0;
