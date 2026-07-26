-- RBAC: ملفات المستخدمين المرتبطة بـ auth.users مع صلاحيات JSONB

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  is_admin boolean not null default false,
  is_suspended boolean not null default false,
  permissions jsonb not null default '{
    "can_access_dashboard": false,
    "can_access_clients": false,
    "can_access_itineraries": false,
    "can_access_marketing": false,
    "can_access_payments": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_is_admin_idx on public.profiles (is_admin) where is_admin = true;

comment on table public.profiles is 'ملف CRM + RBAC؛ id = auth.users.id';

alter table public.profiles enable row level security;

-- تحديث دالة المدير لتشمل profiles.is_admin
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
      and p.is_suspended = false
  )
  or exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and lower(trim(coalesce(e.role, ''))) = 'admin'
  );
$$;

revoke all on function public.is_crm_admin() from public;
grant execute on function public.is_crm_admin() to authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_crm_admin()
  );

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_crm_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or public.is_crm_admin()
  )
  with check (
    id = auth.uid()
    or public.is_crm_admin()
  );

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles
  for delete
  to authenticated
  using (public.is_crm_admin());

-- مزامنة أولية من employees إن وُجدت
insert into public.profiles (id, full_name, email, is_admin, permissions)
select
  e.user_id,
  e.full_name,
  e.email,
  lower(trim(coalesce(e.role, ''))) = 'admin',
  case
    when lower(trim(coalesce(e.role, ''))) = 'admin' then
      '{
        "can_access_dashboard": true,
        "can_access_clients": true,
        "can_access_itineraries": true,
        "can_access_marketing": true,
        "can_access_payments": true
      }'::jsonb
    else
      '{
        "can_access_dashboard": true,
        "can_access_clients": false,
        "can_access_itineraries": true,
        "can_access_marketing": false,
        "can_access_payments": false
      }'::jsonb
  end
from public.employees e
on conflict (id) do update set
  full_name = excluded.full_name,
  email = coalesce(excluded.email, public.profiles.email),
  is_admin = excluded.is_admin or public.profiles.is_admin;
