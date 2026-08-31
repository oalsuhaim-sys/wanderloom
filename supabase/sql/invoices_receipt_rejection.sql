-- Invoice receipt rejection (manual IBAN bank-transfer review)
-- Run once in Supabase SQL editor after invoices_receipt_upload.sql

alter table public.invoices
  add column if not exists rejection_reason text;

comment on column public.invoices.rejection_reason is
  'سبب رفض الإيصال من الإدارة (يُعرض للعميل عند إعادة الرفع)';

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (
    status in (
      'pending',
      'payment_review',
      'paid',
      'awaiting_confirmation',
      'draft',
      'rejected'
    )
  );

comment on column public.invoices.status is
  'pending → payment_review (receipt uploaded) → paid | rejected';
