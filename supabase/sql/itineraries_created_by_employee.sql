-- ربط المسار بالموظف الذي أنشأه (لوحة CRM — عمود اختياري)

alter table public.itineraries
  add column if not exists created_by_employee_id uuid references public.employees (id) on delete set null;

create index if not exists itineraries_created_by_employee_id_idx on public.itineraries (created_by_employee_id);

comment on column public.itineraries.created_by_employee_id is 'موظف CRM الذي أنشأ المسار (يُملأ من المُنشئ عند الحفظ)';
