-- المصاريف التشغيلية (رواتب، إيجار، تسويق، اشتراكات…) — لحساب صافي الربح في «التقارير المالية».
-- جدول جديد فقط، لا يغيّر أي بيانات موجودة. القراءة والكتابة من الـ CRM عبر الخادم.

create table if not exists public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expense_date date not null default current_date,
  category text not null default 'other',
  description text,
  amount numeric not null check (amount >= 0),
  destination text,
  notes text,
  created_by uuid
);

create index if not exists operating_expenses_date_idx on public.operating_expenses (expense_date desc);

comment on table public.operating_expenses is 'المصاريف التشغيلية — تدخل في صافي الربح في التقارير المالية';

alter table public.operating_expenses enable row level security;

drop policy if exists "operating_expenses_staff_select" on public.operating_expenses;
create policy "operating_expenses_staff_select"
  on public.operating_expenses for select to authenticated
  using (public.is_crm_staff());

notify pgrst, 'reload schema';
