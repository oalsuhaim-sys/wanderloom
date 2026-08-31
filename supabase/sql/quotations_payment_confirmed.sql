-- Allow quotations.status = payment_confirmed (admin approved bank transfer)
alter table public.quotations drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in (
    'draft',
    'pending_client',
    'needs_revision',
    'client_responded',
    'approved',
    'awaiting_payment',
    'payment_confirmed',
    'deposit_paid',
    'fully_paid'
  ));

comment on column public.quotations.status is
  'draft | pending_client | needs_revision | client_responded | approved | awaiting_payment | payment_confirmed | deposit_paid | fully_paid';
