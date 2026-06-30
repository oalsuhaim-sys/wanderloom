-- توسيع جدول employees لواجهة إدارة الفريق داخل CRM
alter table public.employees
  add column if not exists email text;

alter table public.employees
  add column if not exists phone_wa text;

alter table public.employees
  add column if not exists role text default 'Advisor';

comment on column public.employees.email is 'البريد الوظيفي للموظف';
comment on column public.employees.phone_wa is 'جوال الموظف (واتساب)';
comment on column public.employees.role is 'الدور داخل CRM: Admin أو Advisor';
