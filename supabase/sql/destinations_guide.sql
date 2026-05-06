-- دليل الوجهات للموظفين (ثقافة، إرشادات، طقس، انطباع احترافي) لكل مدينة ضمن الدول المعتمدة
-- نفّذ السكربت في SQL Editor في Supabase.

create table if not exists public.destinations_guide (
  id uuid primary key default gen_random_uuid(),
  country_id text not null,
  city_id text not null,
  culture text default '',
  guidelines text default '',
  weather_seasons text default '',
  professional_impression text default '',
  updated_at timestamptz not null default now(),
  constraint destinations_guide_country_city_unique unique (country_id, city_id)
);

create index if not exists destinations_guide_country_idx on public.destinations_guide (country_id);

comment on table public.destinations_guide is 'محتوى تثقيفي للموظفين: مدن ضمن وجهات النظام';
comment on column public.destinations_guide.country_id is 'مفتاح الدولة كما في CRM_DESTINATIONS_GUIDE (src/lib/crm-destinations-guide-data.ts)';
comment on column public.destinations_guide.city_id is 'مفتاح المدينة كما في CRM_DESTINATIONS_GUIDE';

alter table public.destinations_guide enable row level security;

drop policy if exists "destinations_guide_anon_all" on public.destinations_guide;
create policy "destinations_guide_anon_all"
  on public.destinations_guide
  for all
  to anon
  using (true)
  with check (true);
