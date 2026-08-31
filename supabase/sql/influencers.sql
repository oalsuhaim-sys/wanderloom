-- Influencers / celebrities SSOT table
-- Run once if `influencers` does not exist yet. Safe to re-run.

create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  platforms text,
  content_type text,
  content_focus text,
  profile_url text,
  country_code text,
  city text,
  rating numeric(3,2),
  completed_trips integer not null default 0,
  availability_status text,
  category text,
  iban text,
  status text not null default 'active'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  dna_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists influencers_status_idx on public.influencers (status);
create index if not exists influencers_name_idx on public.influencers (name);

alter table public.influencers enable row level security;

drop policy if exists influencers_authenticated_all on public.influencers;
create policy influencers_authenticated_all
  on public.influencers for all to authenticated using (true) with check (true);

comment on table public.influencers is
  'مشاهير ومؤثرون — مصدر الحقيقة بدل celebrities';
