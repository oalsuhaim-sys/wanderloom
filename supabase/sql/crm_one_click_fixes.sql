-- =============================================================================
-- إصلاحات CRM بنسخة ولصق واحدة في Supabase → SQL Editor → Run
-- =============================================================================
-- 1) عمود memory_vault.itinerary_id (يُستخدم في الإدراج وصفحة الذكريات)
-- 2) التعرف على المدير + رؤية كل الموظفين لصفحة الفريق (RLS)
--
-- قبل التشغيل: غيّر البريد في السطر المعلّم بـ <<< أدناه.
-- =============================================================================

-- ─── 1) ذكريات العملاء: عمود itinerary_id ─────────────────────────────────
alter table public.memory_vault
  add column if not exists itinerary_id text;

comment on column public.memory_vault.itinerary_id is 'معرّف المسار (نص)؛ يُملأ من العميل عند رفع الذكريات';

-- ─── 2) دالة يقرأ جدول employees دون حلقة RLS (للتحقق من دور المدير) ─────
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

-- سياسة قراءة: كل مستخدم يرى سجله، والمدير يرى الجميع
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

-- إدراج موظفين جدد من CRM: المدير فقط (يُتجاهل إن وُجدت سياسة أوسع مسبقاً)
drop policy if exists "employees_insert_admin" on public.employees;
create policy "employees_insert_admin"
  on public.employees
  for insert
  to authenticated
  with check (public.is_crm_admin());

-- تحديث أدوار: المدير فقط
drop policy if exists "employees_update_admin" on public.employees;
create policy "employees_update_admin"
  on public.employees
  for update
  to authenticated
  using (public.is_crm_admin())
  with check (public.is_crm_admin());

-- ─── 3) ترقية حسابك إلى Admin (غيّر البريد في السطر التالي ثم شغّل الملف) ─
-- <<< ضع هنا نفس إيميل تسجيل الدخول في Supabase Auth
insert into public.employees (user_id, full_name, role, job_title, email)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email::text, '@', 1), 'مدير النظام'),
  'Admin',
  'CRM Admin',
  u.email::text
from auth.users u
where lower(u.email::text) = lower('your-admin@example.com')
on conflict (user_id) do update
set
  role = 'Admin',
  job_title = coalesce(excluded.job_title, employees.job_title),
  email = coalesce(excluded.email, employees.email),
  full_name = coalesce(nullif(trim(excluded.full_name), ''), employees.full_name);

-- إن لم يُنشأ أي صف: تأكد أن المستخدم موجود في Authentication ثم أعد تشغيل الاستعلام بعد تصحيح البريد.
-- إن كان جدول employees بلا عمود email: نفّذ أولاً supabase/sql/employees_contact_role.sql
