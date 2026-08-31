-- Partner / expert intelligence columns for directory cards
-- Applies to leaders, experts, celebrities. Safe to re-run.

do $$
declare
  t text;
begin
  foreach t in array array['leaders', 'experts', 'celebrities']
  loop
    execute format(
      'alter table if exists public.%I add column if not exists country_code text',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists city text',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists rating numeric(3,2)',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists completed_trips integer not null default 0',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists availability_status text',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists category text',
      t
    );
    execute format(
      'alter table if exists public.%I add column if not exists iban text',
      t
    );
  end loop;
end $$;

do $$
declare
  t text;
  cname text;
begin
  foreach t in array array['leaders', 'experts', 'celebrities']
  loop
    cname := t || '_availability_status_check';
    if not exists (select 1 from pg_constraint where conname = cname) then
      execute format(
        'alter table public.%I add constraint %I check (
          availability_status is null
          or availability_status in (''available'', ''busy'', ''unavailable'', ''booked'')
        )',
        t,
        cname
      );
    end if;
  end loop;
end $$;
