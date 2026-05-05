-- =============================================================================
-- Wanderloom — الجلسات والتسجيلات (الهيكل النهائي) + RLS لـ anon / authenticated
-- نفّذ في Supabase → SQL Editor. راجع التحذيرات الأمنية قبل الإنتاج.
-- =============================================================================

-- جدول الجلسات
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  session_type text not null default 'online',
  price numeric(12, 2) not null default 0,
  spots integer not null default 1,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists sessions_date_idx on public.sessions (date asc);

-- تسجيلات العملاء
create table if not exists public.session_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  name text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  constraint session_registrations_session_whatsapp unique (session_id, whatsapp)
);

create index if not exists session_registrations_session_id_idx on public.session_registrations (session_id);
create index if not exists session_registrations_created_at_idx on public.session_registrations (created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.sessions to anon, authenticated;
grant select, insert, update on public.session_registrations to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter table public.sessions enable row level security;
alter table public.session_registrations enable row level security;

-- إزالة سياسات قديمة (أسماء سابقة)
drop policy if exists "sessions_anon_select" on public.sessions;
drop policy if exists "sessions_anon_insert" on public.sessions;
drop policy if exists "sessions_anon_update" on public.sessions;
drop policy if exists "sessions_anon_delete" on public.sessions;
drop policy if exists "session_registrations_anon_select" on public.session_registrations;
drop policy if exists "session_registrations_anon_insert" on public.session_registrations;
drop policy if exists "session_registrations_anon_update" on public.session_registrations;
drop policy if exists "session_registrations_anon_delete" on public.session_registrations;

-- anon: قراءة وكتابة وتحديث (كما طُلب سابقاً — شدّد السياسات في الإنتاج)
create policy "sessions_anon_select" on public.sessions for select to anon using (true);
create policy "sessions_anon_insert" on public.sessions for insert to anon with check (true);
create policy "sessions_anon_update" on public.sessions for update to anon using (true) with check (true);

create policy "session_registrations_anon_select" on public.session_registrations for select to anon using (true);
create policy "session_registrations_anon_insert" on public.session_registrations for insert to anon with check (true);
create policy "session_registrations_anon_update" on public.session_registrations for update to anon using (true) with check (true);

drop policy if exists "sessions_authenticated_select" on public.sessions;
drop policy if exists "sessions_authenticated_insert" on public.sessions;
drop policy if exists "sessions_authenticated_update" on public.sessions;
drop policy if exists "sessions_authenticated_delete" on public.sessions;

create policy "sessions_authenticated_select" on public.sessions for select to authenticated using (true);
create policy "sessions_authenticated_insert" on public.sessions for insert to authenticated with check (true);
create policy "sessions_authenticated_update" on public.sessions for update to authenticated using (true) with check (true);
create policy "sessions_authenticated_delete" on public.sessions for delete to authenticated using (true);

drop policy if exists "session_registrations_authenticated_select" on public.session_registrations;
drop policy if exists "session_registrations_authenticated_insert" on public.session_registrations;
drop policy if exists "session_registrations_authenticated_update" on public.session_registrations;
drop policy if exists "session_registrations_authenticated_delete" on public.session_registrations;

create policy "session_registrations_authenticated_select" on public.session_registrations for select to authenticated using (true);
create policy "session_registrations_authenticated_insert" on public.session_registrations for insert to authenticated with check (true);
create policy "session_registrations_authenticated_update" on public.session_registrations for update to authenticated using (true) with check (true);
create policy "session_registrations_authenticated_delete" on public.session_registrations for delete to authenticated using (true);
