-- Cal.com webhook writes full ISO start into leads.meeting_date
-- Run in Supabase SQL Editor if meeting_date is still `date` or missing.

alter table if exists public.leads
  add column if not exists meeting_date timestamptz;

-- If an older `date` column exists, widen it to timestamptz
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'meeting_date'
      and data_type = 'date'
  ) then
    alter table public.leads
      alter column meeting_date type timestamptz
      using case
        when meeting_date is null then null
        else (meeting_date::timestamp at time zone 'UTC')
      end;
  end if;
end $$;

comment on column public.leads.meeting_date is
  'Cal.com booking start (timestamptz) — written by /api/webhooks/cal';

create index if not exists leads_meeting_date_idx
  on public.leads (meeting_date)
  where meeting_date is not null;
