-- مجموعة أزياء السفر (Wardrobe Collection) — CRM
-- نفّذ في Supabase SQL Editor.

create table if not exists public.travel_wardrobe (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null default 0,
  image_url text,
  purchase_url text,
  seasons text[] not null default '{}',
  destinations text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists travel_wardrobe_created_at_idx on public.travel_wardrobe (created_at desc);

comment on table public.travel_wardrobe is 'منتجات سفر وأزياء مقترحة من Wanderloom';
comment on column public.travel_wardrobe.seasons is 'مواسم مناسبة، مثال: شتاء، صيف';
comment on column public.travel_wardrobe.destinations is 'وجهات مناسبة، مثال: سويسرا، المالديف';

alter table public.travel_wardrobe enable row level security;

drop policy if exists "travel_wardrobe_anon_all" on public.travel_wardrobe;
create policy "travel_wardrobe_anon_all"
  on public.travel_wardrobe
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "travel_wardrobe_authenticated_all" on public.travel_wardrobe;
create policy "travel_wardrobe_authenticated_all"
  on public.travel_wardrobe
  for all
  to authenticated
  using (true)
  with check (true);
