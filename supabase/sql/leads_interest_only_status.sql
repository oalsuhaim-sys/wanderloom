-- Add interest_only status for lightweight «تسجيل اهتمام» sign-ups
-- Run in Supabase SQL Editor after leads_kanban_status.sql

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
      'converted',
      'awaiting_dna',
      'meeting',
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

comment on column public.leads.status is
  'Master pipeline + interest_only (marketing sign-ups, not quote requests)';
