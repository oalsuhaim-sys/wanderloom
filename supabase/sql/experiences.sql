-- تجارب استثنائية مُنتقاة (Curated Experiences) لاقتراحها للعملاء عبر الفريق
-- نفّذ في SQL Editor بعد جداول CRM الأساسية.

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  country text not null,
  city text not null default '',
  category text not null
    constraint experiences_category_check
      check (category in ('cooking', 'heritage', 'shopping', 'relaxation')),
  description text not null,
  detail_url text,
  created_at timestamptz not null default now()
);

create index if not exists experiences_country_idx on public.experiences (country);
create index if not exists experiences_category_idx on public.experiences (category);

comment on table public.experiences is 'تجارب فاخرة مقترحة من Wanderloom للموظفين';
comment on column public.experiences.category is 'cooking | heritage | shopping | relaxation';

alter table public.experiences enable row level security;

drop policy if exists "experiences_anon_all" on public.experiences;
create policy "experiences_anon_all"
  on public.experiences
  for all
  to anon
  using (true)
  with check (true);
