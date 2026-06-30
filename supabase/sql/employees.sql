-- موظفو CRM مرتبطون بحسابات Supabase Auth

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  role text,
  job_title text,
  created_at timestamptz not null default now(),
  constraint employees_user_id_key unique (user_id)
);

create index if not exists employees_user_id_idx on public.employees (user_id);

comment on table public.employees is 'بيانات الموظف للـ CRM؛ user_id = auth.users.id';

alter table public.employees enable row level security;

-- دالة للتحقق من المدير دون حلقة RLS على نفس الجدول
create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and lower(trim(coalesce(e.role, ''))) = 'admin'
  );
$$;

revoke all on function public.is_crm_admin() from public;
grant execute on function public.is_crm_admin() to authenticated;

drop policy if exists "employees_select_own" on public.employees;
drop policy if exists "employees_select_self_or_admin" on public.employees;
create policy "employees_select_self_or_admin"
  on public.employees
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_crm_admin()
  );

drop policy if exists "employees_insert_admin" on public.employees;
create policy "employees_insert_admin"
  on public.employees
  for insert
  to authenticated
  with check (public.is_crm_admin());

drop policy if exists "employees_update_admin" on public.employees;
create policy "employees_update_admin"
  on public.employees
  for update
  to authenticated
  using (public.is_crm_admin())
  with check (public.is_crm_admin());

-- إدراج السجلات يدوياً من لوحة Supabase (جدول auth.users) أو عبر خدمة بصلاحيات service_role
-- ترقية أول مدير + عمود memory_vault.itinerary_id: راجع supabase/sql/crm_one_click_fixes.sql
