-- Persist passenger DOB on group_members (group registration source for CRM age).
alter table public.group_members
  add column if not exists birth_date date;

comment on column public.group_members.birth_date is
  'Passenger date of birth from group onboarding — used for CRM age display';

create index if not exists group_members_birth_date_idx
  on public.group_members (birth_date)
  where birth_date is not null;
