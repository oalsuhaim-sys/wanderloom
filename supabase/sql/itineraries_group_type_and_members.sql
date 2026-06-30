-- نوع الرحلة (فردية / قروب)، اسم القروب، وجدول ربط العملاء بالمسار (قروبات)
-- نفّذ في SQL Editor بعد وجود جداول public.itineraries و public.clients.

alter table public.itineraries
  add column if not exists trip_type text not null default 'Individual';

alter table public.itineraries
  add column if not exists group_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'itineraries' and c.conname = 'itineraries_trip_type_check'
  ) then
    alter table public.itineraries
      add constraint itineraries_trip_type_check
      check (trip_type in ('Individual', 'Group'));
  end if;
end $$;

comment on column public.itineraries.trip_type is 'Individual | Group';
comment on column public.itineraries.group_name is 'اسم القروب عند trip_type = Group';

create table if not exists public.itinerary_client_members (
  itinerary_id bigint not null references public.itineraries (id) on delete cascade,
  client_id integer not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (itinerary_id, client_id)
);

create index if not exists itinerary_client_members_client_id_idx
  on public.itinerary_client_members (client_id);

comment on table public.itinerary_client_members is 'أعضاء القروب أو ربط عميل CRM بمسار (itineraries)';

alter table public.itinerary_client_members enable row level security;

drop policy if exists "itinerary_client_members_anon_all" on public.itinerary_client_members;
create policy "itinerary_client_members_anon_all"
  on public.itinerary_client_members
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "itinerary_client_members_authenticated_all" on public.itinerary_client_members;
create policy "itinerary_client_members_authenticated_all"
  on public.itinerary_client_members
  for all
  to authenticated
  using (true)
  with check (true);
