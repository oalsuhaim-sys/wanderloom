-- ذكريات العميل في بوابة الملف الشخصي VIP
create table if not exists public.client_memories (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients (id) on delete cascade,
  image_url text not null,
  caption text,
  title text,
  location text,
  memory_date date,
  itinerary_id bigint references public.itineraries (id) on delete set null,
  location_name text,
  created_at timestamptz not null default now()
);

alter table public.client_memories
  add column if not exists itinerary_id bigint references public.itineraries (id) on delete set null;

alter table public.client_memories
  add column if not exists location_name text;

create index if not exists client_memories_itinerary_id_idx
  on public.client_memories (itinerary_id, created_at desc)
  where itinerary_id is not null;

create index if not exists client_memories_client_id_idx
  on public.client_memories (client_id, created_at desc);

-- Ensure portal + CRM can read/write client_memories (upload uses service role; CRM may use anon)
alter table public.client_memories enable row level security;

drop policy if exists "client_memories_anon_all" on public.client_memories;
create policy "client_memories_anon_all"
  on public.client_memories
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "client_memories_authenticated_all" on public.client_memories;
create policy "client_memories_authenticated_all"
  on public.client_memories
  for all
  to authenticated
  using (true)
  with check (true);
