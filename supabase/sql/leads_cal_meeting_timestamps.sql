-- Optional Cal.com start/end instants for expiry checks.
-- meeting_date stays the display source (timestamptz). Run in the Supabase SQL editor.

alter table if exists public.leads
  add column if not exists meeting_raw_timestamp timestamptz;

alter table if exists public.leads
  add column if not exists meeting_end_timestamp timestamptz;

comment on column public.leads.meeting_raw_timestamp is
  'Cal.com booking start instant (ISO). Used to detect expired meetings.';

comment on column public.leads.meeting_end_timestamp is
  'Cal.com booking end instant (ISO).';
