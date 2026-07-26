-- جداول الشركاء المعيارية (منفصلة عن clients)
-- نفّذ هذا الملف في Supabase SQL Editor بعد نسخ احتياطي.
-- إذا وُجدت جداول قديمة (bigint) من partners_schema.sql، احذفها يدوياً أو استخدم partners_migrate_to_uuid.sql

create extension if not exists "pgcrypto";

-- ─── Leaders ───────────────────────────────────────────────────────────────
create table if not exists public.leaders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  languages text[] default '{}',
  experience_years numeric,
  destinations text,
  referral_code text unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now()
);

-- ─── Destination Experts ───────────────────────────────────────────────────
create table if not exists public.experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty_regions text,
  phone text,
  email text,
  dna_profile jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now()
);

-- ─── Celebrities / Influencers ─────────────────────────────────────────────
create table if not exists public.celebrities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platforms text,
  content_focus text,
  profile_url text,
  phone text,
  email text,
  status text not null default 'active'
    check (status in ('pending', 'active', 'rejected', 'inactive')),
  created_at timestamptz not null default now()
);

-- ─── Partner applications (رادار الشركاء) ────────────────────────────────
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  partner_kind text not null
    check (partner_kind in ('leader', 'expert', 'celebrity')),
  name text not null,
  email text,
  phone text,
  languages text,
  experience_years numeric,
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

create index if not exists leaders_status_idx on public.leaders (status);
create index if not exists experts_name_idx on public.experts (name);
create index if not exists celebrities_name_idx on public.celebrities (name);
create index if not exists partner_applications_status_idx
  on public.partner_applications (status, created_at desc);

alter table public.leaders enable row level security;
alter table public.experts enable row level security;
alter table public.celebrities enable row level security;
alter table public.partner_applications enable row level security;

drop policy if exists leaders_authenticated_all on public.leaders;
create policy leaders_authenticated_all
  on public.leaders for all to authenticated using (true) with check (true);

drop policy if exists experts_authenticated_all on public.experts;
create policy experts_authenticated_all
  on public.experts for all to authenticated using (true) with check (true);

drop policy if exists celebrities_authenticated_all on public.celebrities;
create policy celebrities_authenticated_all
  on public.celebrities for all to authenticated using (true) with check (true);

drop policy if exists partner_applications_anon_insert on public.partner_applications;
create policy partner_applications_anon_insert
  on public.partner_applications for insert to anon with check (true);

drop policy if exists partner_applications_authenticated_all on public.partner_applications;
create policy partner_applications_authenticated_all
  on public.partner_applications for all to authenticated using (true) with check (true);

comment on table public.leaders is 'قادة الرحلات — كيان مستقل عن clients';
comment on table public.experts is 'خبراء الوجهات — كيان مستقل';
comment on table public.celebrities is 'المشاهير والمؤثرين — كيان مستقل (بديل أعمدة clients المتفرقة)';
