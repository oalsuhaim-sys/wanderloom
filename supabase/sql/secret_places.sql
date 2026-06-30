-- أماكن حصرية للدليل السري (VIP) — تُعرض في صفحة الرابط السحري عند unlock_secret_guide
create table if not exists public.secret_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  maps_url text not null,
  country text not null,
  city text,
  created_at timestamptz not null default now()
);

create index if not exists secret_places_country_idx on public.secret_places (country);
create index if not exists secret_places_country_city_idx on public.secret_places (country, city);

comment on table public.secret_places is 'وجهات VIP غير مدرجة في الدليل السياحي العام — تُربط بالدولة/المدينة';
comment on column public.secret_places.city is 'إن وُجدت، يُفضّل مطابقة مدينة من برنامج الرحلة؛ وإلا تُعرض لكل المدن في الدولة المطابقة';

alter table public.secret_places enable row level security;

drop policy if exists "secret_places_anon_select" on public.secret_places;
create policy "secret_places_anon_select"
  on public.secret_places
  for select
  to anon
  using (true);

drop policy if exists "secret_places_authenticated_select" on public.secret_places;
create policy "secret_places_authenticated_select"
  on public.secret_places
  for select
  to authenticated
  using (true);
