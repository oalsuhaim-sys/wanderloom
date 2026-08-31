-- Interactive quotation JSONB + client response status
-- User may already have JSONB columns; this is idempotent.

alter table if exists public.quotations
  add column if not exists itinerary_days jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists hotel_options jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists transport_options jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists activity_options jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists cost_breakdown jsonb not null default '[]'::jsonb;

alter table if exists public.quotations
  add column if not exists client_feedback jsonb not null default '{}'::jsonb;

comment on column public.quotations.itinerary_days is
  'Premium brochure days: [{ dayNumber, date, city, title, description }]';
comment on column public.quotations.hotel_options is
  'Client-selectable hotels: [{ id, city, name, description, price, is_selected_by_client }]';
comment on column public.quotations.transport_options is
  'Client-selectable transport: [{ id, name, description, price, is_selected_by_client }]';
comment on column public.quotations.activity_options is
  'Client-selectable activities: [{ id, name, description, price, is_selected_by_client }]';
comment on column public.quotations.cost_breakdown is
  'Additional costs only (visa, flights, fees): [{ id, item_name, price }] — hotel/transport/activity prices live on options';
comment on column public.quotations.client_feedback is
  'Contextual notes: { general, days, hotels, transport, activities, submitted_at }';

alter table public.quotations drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in (
    'draft',
    'pending_client',
    'needs_revision',
    'client_responded',
    'approved',
    'awaiting_payment',
    'deposit_paid',
    'fully_paid'
  ));

comment on column public.quotations.status is
  'draft | pending_client | needs_revision | client_responded | approved | awaiting_payment | deposit_paid | fully_paid';
