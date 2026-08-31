-- Dynamic Group Pricing Engine — persisted pricing snapshots
create table if not exists public.group_pricings (
  id uuid primary key default gen_random_uuid(),
  title text,
  passengers_count integer not null default 1 check (passengers_count >= 1),
  nights_count integer not null default 1 check (nights_count >= 1),
  direct_costs jsonb not null default '{}'::jsonb,
  fixed_costs jsonb not null default '{}'::jsonb,
  hotels_breakdown jsonb not null default '[]'::jsonb,
  profit_margin numeric not null default 30,
  manual_selling_price numeric,
  final_selling_price_per_pax numeric not null default 0,
  total_group_revenue numeric not null default 0,
  total_group_net_profit numeric not null default 0,
  -- Legacy aliases (kept for older rows / dual-write)
  final_selling_price numeric not null default 0,
  total_revenue numeric not null default 0,
  total_net_profit numeric not null default 0,
  effective_margin numeric,
  total_base_cost_per_passenger numeric,
  itinerary_id bigint references public.itineraries (id) on delete set null,
  client_id integer references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evolve existing installs toward the CRM save payload shape
alter table public.group_pricings
  add column if not exists title text;

alter table public.group_pricings
  add column if not exists hotels_breakdown jsonb not null default '[]'::jsonb;

alter table public.group_pricings
  add column if not exists manual_selling_price numeric;

alter table public.group_pricings
  add column if not exists final_selling_price_per_pax numeric not null default 0;

alter table public.group_pricings
  add column if not exists total_group_revenue numeric not null default 0;

alter table public.group_pricings
  add column if not exists total_group_net_profit numeric not null default 0;

alter table public.group_pricings
  add column if not exists final_selling_price numeric not null default 0;

alter table public.group_pricings
  add column if not exists total_revenue numeric not null default 0;

alter table public.group_pricings
  add column if not exists total_net_profit numeric not null default 0;

alter table public.group_pricings
  add column if not exists effective_margin numeric;

alter table public.group_pricings
  add column if not exists total_base_cost_per_passenger numeric;

alter table public.group_pricings
  add column if not exists itinerary_id bigint;

alter table public.group_pricings
  add column if not exists client_id integer;

alter table public.group_pricings
  add column if not exists leader_id bigint references public.leaders (id) on delete set null;

alter table public.group_pricings
  add column if not exists itinerary_name text;

alter table public.group_pricings
  add column if not exists leader_name text;

create index if not exists group_pricings_itinerary_id_idx
  on public.group_pricings (itinerary_id)
  where itinerary_id is not null;

create index if not exists group_pricings_client_id_idx
  on public.group_pricings (client_id)
  where client_id is not null;

create index if not exists group_pricings_leader_id_idx
  on public.group_pricings (leader_id)
  where leader_id is not null;

create index if not exists group_pricings_created_at_idx
  on public.group_pricings (created_at desc);

alter table public.group_pricings enable row level security;

drop policy if exists "group_pricings_select" on public.group_pricings;
create policy "group_pricings_select"
  on public.group_pricings for select
  to anon, authenticated
  using (true);

drop policy if exists "group_pricings_insert" on public.group_pricings;
create policy "group_pricings_insert"
  on public.group_pricings for insert
  to anon, authenticated
  with check (true);

drop policy if exists "group_pricings_update" on public.group_pricings;
create policy "group_pricings_update"
  on public.group_pricings for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "group_pricings_delete" on public.group_pricings;
create policy "group_pricings_delete"
  on public.group_pricings for delete
  to anon, authenticated
  using (true);

comment on table public.group_pricings is
  'CRM Dynamic Group Pricing Engine snapshots (unified VIP hotel rate, COGS, margin)';

comment on column public.group_pricings.hotels_breakdown is
  'JSONB array of hotel occupancy / VIP unified-rate lines';

-- Refresh PostgREST schema cache so the API sees public.group_pricings immediately
notify pgrst, 'reload schema';
