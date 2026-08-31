-- Add payment_confirmed to leads.status for Kanban «تم الدفع / المسارات»
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
      'interview_scheduled',
      'quote_stage',
      'awaiting_payment',
      'pending_payment',
      'payment_confirmed',
      'preparing_itinerary',
      'delivered',
      'postponed',
      -- Legacy
      'new',
      'pending_approval',
      'pending',
      'dna_sent',
      'planning',
      'active',
      'completed',
      'in_progress',
      'processing',
      'processing_quote',
      'approved',
      'done',
      'archived',
      'dna_pending',
      'rejected',
      'dead',
      'confirmed'
    )
  );

-- Move paid/route stages into payment_confirmed for the 5-column board
update public.leads
set status = 'payment_confirmed'
where status in ('preparing_itinerary', 'delivered', 'active', 'confirmed');

comment on column public.leads.status is
  'Master pipeline: radar_pending | awaiting_dna | meeting | quote_stage | awaiting_payment | payment_confirmed | …';
