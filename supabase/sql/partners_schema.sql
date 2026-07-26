-- شركاء وندرلُوم — منفصلون تماماً عن جدول العملاء (clients)

create table if not exists public.leaders (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  phone text,
  languages text,
  experience_years integer,
  preferred_destinations text,
  referral_code text unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experts (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  phone text,
  languages text,
  experience_years integer,
  preferred_destinations text,
  specialty text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.celebrities (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  phone text,
  platforms text,
  follower_count integer,
  preferred_destinations text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_applications (
  id bigint generated always as identity primary key,
  partner_kind text not null
    check (partner_kind in ('leader', 'expert', 'celebrity')),
  name text not null,
  email text,
  phone text,
  languages text,
  experience_years integer,
  preferred_destinations text,
  platforms text,
  follower_count integer,
  bio text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_applications_status_idx
  on public.partner_applications (status, created_at desc);

create index if not exists partner_applications_kind_idx
  on public.partner_applications (partner_kind, status);

create index if not exists leaders_status_idx on public.leaders (status);
create index if not exists leaders_referral_code_idx on public.leaders (referral_code)
  where referral_code is not null;

alter table public.partner_applications enable row level security;
alter table public.leaders enable row level security;
alter table public.experts enable row level security;
alter table public.celebrities enable row level security;

drop policy if exists partner_applications_anon_insert on public.partner_applications;
create policy partner_applications_anon_insert
  on public.partner_applications for insert to anon with check (true);

drop policy if exists partner_applications_anon_select on public.partner_applications;
create policy partner_applications_anon_select
  on public.partner_applications for select to anon using (true);

drop policy if exists partner_applications_authenticated_all on public.partner_applications;
create policy partner_applications_authenticated_all
  on public.partner_applications for all to authenticated using (true) with check (true);

-- إزالة «ليدر» من أنواع العملاء — العملاء فقط عملاء
alter table public.clients drop constraint if exists clients_client_type_check;
alter table public.clients
  add constraint clients_client_type_check
    check (client_type in ('عميل', 'مؤثر'));

comment on table public.leaders is 'قادة الرحلات — شركاء موظفون، ليسوا عملاء';
comment on table public.partner_applications is 'طلبات انضمام الشركاء (رادار الشركاء)';
