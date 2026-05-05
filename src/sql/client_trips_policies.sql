-- Run this SQL in Supabase SQL Editor.
-- Enables RLS and allows authenticated users to read/insert/update/delete client_trips.

alter table public.client_trips enable row level security;

create policy "client_trips_select_authenticated"
on public.client_trips
for select
to authenticated
using (true);

create policy "client_trips_insert_authenticated"
on public.client_trips
for insert
to authenticated
with check (true);

create policy "client_trips_update_authenticated"
on public.client_trips
for update
to authenticated
using (true)
with check (true);

create policy "client_trips_delete_authenticated"
on public.client_trips
for delete
to authenticated
using (true);
