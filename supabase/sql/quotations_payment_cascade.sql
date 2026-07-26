-- دفعات العروض + حالات السداد (تُحدَّث تلقائياً عند دفع فاتورة)
alter table if exists public.quotations
  add column if not exists paid_amount numeric(12, 2) not null default 0;

alter table if exists public.quotations
  add column if not exists remaining_amount numeric(12, 2);

alter table if exists public.quotations
  add column if not exists trip_category text not null default 'private'
    check (trip_category in ('private', 'group'));

comment on column public.quotations.paid_amount is 'مجموع الفواتير المدفوعة المرتبطة بهذا العرض';
comment on column public.quotations.remaining_amount is 'المتبقي على العميل = الإجمالي − المدفوع';
comment on column public.quotations.trip_category is 'private = رحلة خاصة · group = رحلة جماعية';

-- توسيع حالات status لتشمل مراحل السداد
alter table public.quotations drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in (
    'draft',
    'pending_client',
    'approved',
    'awaiting_payment',
    'deposit_paid',
    'fully_paid'
  ));

comment on column public.quotations.status is
  'draft | pending_client | approved | awaiting_payment | deposit_paid | fully_paid';

-- backfill المتبقي من الإجمالي الحالي
update public.quotations q
set remaining_amount = greatest(
  0,
  coalesce(nullif(q.grand_total, 0), q.total_estimated_cost, 0)
    - coalesce(q.paid_amount, 0)
)
where q.remaining_amount is null;
