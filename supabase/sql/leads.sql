-- جدول leads — نموذج «سجّل رحلتك» والتواصل العام
-- نفّذ في SQL Editor في Supabase.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone_wa text not null,
  age int check (age is null or (age > 0 and age < 130)),
  destinations text[] not null default '{}',
  travel_date date,
  travel_days int not null default 7 check (travel_days > 0 and travel_days <= 90),
  travelers_count int not null default 1 check (travelers_count > 0 and travelers_count <= 40),
  budget text,
  interests text[] not null default '{}',
  travel_style text,
  daily_pace text,
  walking_readiness text,
  day_start_time text,
  food_preferences text[] not null default '{}',
  accommodation_type text[] not null default '{}',
  final_thoughts text not null,
  form_type text not null default 'trip_log' check (form_type in ('trip_log', 'contact')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'processing', 'processing_quote', 'converted', 'done', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_form_type_idx on public.leads (form_type);

create index if not exists leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

drop policy if exists "leads_anon_insert" on public.leads;
create policy "leads_anon_insert"
  on public.leads
  for insert
  to anon
  with check (true);

drop policy if exists "leads_crm_select" on public.leads;
create policy "leads_crm_select"
  on public.leads
  for select
  to anon
  using (true);

-- ترقية جدول موجود مسبقاً
alter table public.leads add column if not exists status text not null default 'new';

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'in_progress', 'processing', 'processing_quote', 'converted', 'done', 'archived'));

drop policy if exists "leads_crm_update" on public.leads;
create policy "leads_crm_update"
  on public.leads
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "leads_crm_delete" on public.leads;
create policy "leads_crm_delete"
  on public.leads
  for delete
  to anon
  using (true);
