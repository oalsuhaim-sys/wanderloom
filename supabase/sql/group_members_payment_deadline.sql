-- Payment scarcity / grace period for group_members
-- Run after group_members.sql

alter table public.group_members
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'waived', 'expired'));

alter table public.group_members
  add column if not exists payment_deadline timestamptz;

comment on column public.group_members.payment_status is
  'Seat payment state: pending | paid | waived | expired';

comment on column public.group_members.payment_deadline is
  'Null = no countdown (below scarcity threshold). Set when booked_seats >= SCARCITY_THRESHOLD.';

create index if not exists group_members_payment_deadline_idx
  on public.group_members (payment_deadline)
  where payment_deadline is not null and payment_status = 'pending';
