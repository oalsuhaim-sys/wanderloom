-- مرحلة البيع في مسار High-Ticket Funnel (جدول clients الموحّد)

alter table if exists public.clients
  add column if not exists sales_stage text;

comment on column public.clients.sales_stage is
  'مرحلة البيع: طلب انضمام جديد | تم تحديد مقابلة | بانتظار الدفع (ساعتين) | عميل مؤكد';

create index if not exists clients_sales_stage_idx
  on public.clients (sales_stage)
  where sales_stage is not null and sales_stage <> '';
