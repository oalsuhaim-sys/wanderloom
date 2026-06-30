-- ربط عروض الأسعار بطلبات «سجّل رحلتك» (اختياري)
alter table if exists public.quotations
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

create index if not exists quotations_lead_id_idx on public.quotations (lead_id)
  where lead_id is not null;

comment on column public.quotations.lead_id is 'معرّف الطلب من جدول leads عند التحويل من صندوق الوارد';
