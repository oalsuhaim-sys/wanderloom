-- Public magic-link token for tour leader availability portal
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table if exists public.leaders
  add column if not exists calendar_token text;

create unique index if not exists leaders_calendar_token_uidx
  on public.leaders (calendar_token)
  where calendar_token is not null;

comment on column public.leaders.calendar_token is
  'Opaque token for /leader-calendar?token=… public availability portal (no CRM login).';
