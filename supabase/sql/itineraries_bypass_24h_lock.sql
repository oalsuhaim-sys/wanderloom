-- Manual override for VIP client 24h vault lock
alter table public.itineraries
  add column if not exists bypass_24h_lock boolean not null default false;

comment on column public.itineraries.bypass_24h_lock is
  'When true, client itinerary timeline unlocks immediately (ignores 24h-before-start rule).';
