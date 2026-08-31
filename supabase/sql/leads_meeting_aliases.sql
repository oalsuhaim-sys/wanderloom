-- Optional alias columns for VIP / individual Cal.com meeting slots
-- (canonical fields remain interview_date / interview_time)

alter table if exists public.leads
  add column if not exists meeting_date date,
  add column if not exists meeting_time text,
  add column if not exists scheduled_at timestamptz;

comment on column public.leads.meeting_date is 'Alias for interview_date — VIP / individual meeting day';
comment on column public.leads.meeting_time is 'Alias for interview_time — VIP / individual meeting time label';
comment on column public.leads.scheduled_at is 'Full timestamptz for Cal.com booking start';
