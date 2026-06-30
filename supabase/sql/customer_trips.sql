-- رحلات العملاء (سجل دائم لصفحة تفاصيل العميل)
-- نفّذ في SQL Editor بعد جدول clients.

create table if not exists public.customer_trips (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  destination text not null,
  trip_date date,
  cost numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customer_trips_client_id_idx on public.customer_trips (client_id);
create index if not exists customer_trips_trip_date_idx on public.customer_trips (trip_date desc);

comment on table public.customer_trips is 'سجل رحلات العميل (CRM)';

alter table public.customer_trips enable row level security;

drop policy if exists "customer_trips_anon_all" on public.customer_trips;
create policy "customer_trips_anon_all"
  on public.customer_trips
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "customer_trips_authenticated_all" on public.customer_trips;
create policy "customer_trips_authenticated_all"
  on public.customer_trips
  for all
  to authenticated
  using (true)
  with check (true);
