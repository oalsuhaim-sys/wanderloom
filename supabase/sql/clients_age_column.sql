-- Optional numeric age on clients — synced from trip registration.
-- Safe to run multiple times. ClientCard prefers clients.age, then birth_date.

alter table public.clients
  add column if not exists age integer;

comment on column public.clients.age is
  'Age in years captured at trip registration / CRM; preferred for ClientCard display.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_age_range_check'
  ) then
    alter table public.clients
      add constraint clients_age_range_check
      check (age is null or (age >= 1 and age <= 120));
  end if;
exception
  when others then
    raise notice 'clients.age constraint skipped: %', sqlerrm;
end $$;
