-- إضافة حالة «مسودة» لعروض الأسعار (استنساخ سريع)
alter table public.quotations drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in ('draft', 'pending_client', 'approved'));

comment on column public.quotations.status is 'draft | pending_client | approved';
