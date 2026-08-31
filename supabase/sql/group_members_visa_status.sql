-- Trip-scoped visa status on group_members (not on clients)
-- Run after group_members.sql / group_members_payment_deadline.sql

alter table public.group_members
  add column if not exists visa_status text;

comment on column public.group_members.visa_status is
  'Trip-scoped visa state for this membership (e.g. pending | issued | rejected). Not a global client profile field.';

create index if not exists group_members_visa_status_idx
  on public.group_members (visa_status)
  where visa_status is not null;
