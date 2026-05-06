-- طلبات العملاء من الموقع العام (نموذج «سجّل رحلتك»)
-- نفّذ السكربت في SQL Editor في Supabase.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone_wa text not null,
  city text,
  destination_dream text not null,
  travel_window text,
  travelers_count int not null default 1
    check (travelers_count > 0 and travelers_count < 100),
  trip_style text,
  budget_range text,
  interests_notes text,
  source text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  trip_form jsonb not null default '{}'::jsonb,
  travel_days int,
  travel_start_date date,
  dream_closing text
);

create index if not exists customers_created_at_idx on public.customers (created_at desc);

alter table public.customers enable row level security;

drop policy if exists "customers_anon_insert" on public.customers;
create policy "customers_anon_insert"
  on public.customers
  for insert
  to anon
  with check (true);

drop policy if exists "customers_anon_select" on public.customers;
