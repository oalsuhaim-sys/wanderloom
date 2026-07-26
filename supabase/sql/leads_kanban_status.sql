-- Master CRM pipeline statuses for leads.status
-- Run in Supabase SQL Editor after deploy.

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
  check (
    status in (
      -- Master pipeline
      'radar_pending',
      'radar_rejected',
      'awaiting_dna',
      'meeting',
      'quote_stage',
      'awaiting_payment',
      'preparing_itinerary',
      'delivered',
      'postponed',
      -- Legacy (normalized in app)
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
      'dead'
    )
  );

-- Migrate common legacy values forward
update public.leads set status = 'radar_pending' where status in ('new', 'new_request', 'pending_approval') or status is null;
update public.leads set status = 'awaiting_dna' where status in ('dna_sent', 'dna_pending');
update public.leads set status = 'quote_stage' where status in ('planning', 'approved', 'processing', 'processing_quote', 'in_progress');
update public.leads set status = 'preparing_itinerary' where status in ('active', 'converted', 'confirmed');
update public.leads set status = 'delivered' where status in ('completed', 'done', 'archived');

comment on column public.leads.status is
  'Master pipeline: radar_pending | radar_rejected | awaiting_dna | meeting | quote_stage | awaiting_payment | preparing_itinerary | delivered | postponed';
