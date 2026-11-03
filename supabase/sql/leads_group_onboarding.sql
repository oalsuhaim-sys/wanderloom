-- Group trip onboarding funnel: interview scheduling columns + status
-- Run in Supabase SQL Editor after leads_kanban_status.sql

alter table public.leads add column if not exists interview_date date;
alter table public.leads add column if not exists interview_time text;

comment on column public.leads.interview_date is 'Group onboarding — scheduled intro call date';
comment on column public.leads.interview_time is 'Group onboarding — scheduled intro call time slot label';

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
  check (
    status in (
      'radar_pending',
      'radar_rejected',
      'interest_only',
      'interest',
      'register_interest',
      'awaiting_dna',
      'meeting',
      'interview_scheduled',
      'quote_stage',
      'awaiting_payment',
      'preparing_itinerary',
      'delivered',
      'postponed',
      'new',
      'pending_approval',
      'dna_sent',
      'planning',
      'active',
      'completed',
      'in_progress',
      'processing',
      'processing_quote',
      'approved',
      'converted',
      'done',
      'archived',
      'dna_pending',
      'pending_payment',
      'rejected',
      'dead',
      'pending'
    )
  );

-- Optional: allow group_trip form_type
alter table public.leads drop constraint if exists leads_form_type_check;
alter table public.leads
  add constraint leads_form_type_check
  check (form_type in ('trip_log', 'contact', 'group_trip'));
