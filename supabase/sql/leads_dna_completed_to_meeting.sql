-- One-time: move leads that already completed DNA but remain in «بانتظار DNA» → «اجتماع العميل»
-- Also links orphan leads by phone when client_id is missing.

alter table public.clients
  add column if not exists dna_completed_at timestamptz;

comment on column public.clients.dna_completed_at is
  'When Travel DNA / onboarding form was completed';

-- Stamp completion time for clients with DNA evidence
update public.clients
set
  onboarding_completed = true,
  dna_completed_at = coalesce(dna_completed_at, now())
where
  onboarding_completed is distinct from true
  and (
    travel_dna is not null
    or nullif(trim(coalesce(dna_interests::text, '')), '') is not null
    or nullif(trim(coalesce(favorite_drink, '')), '') is not null
    or nullif(trim(coalesce(flight_seat, '')), '') is not null
    or nullif(trim(coalesce(hotel_preference, '')), '') is not null
  );

-- Link leads missing client_id when phone matches a DNA-complete client
update public.leads l
set client_id = c.id
from public.clients c
where l.client_id is null
  and nullif(trim(coalesce(l.phone_wa, '')), '') is not null
  and (
    nullif(trim(coalesce(c.phone_wa, '')), '') = nullif(trim(coalesce(l.phone_wa, '')), '')
    or nullif(trim(coalesce(c.phone_number, '')), '') = nullif(trim(coalesce(l.phone_wa, '')), '')
  )
  and (
    c.onboarding_completed = true
    or c.travel_dna is not null
    or nullif(trim(coalesce(c.dna_interests::text, '')), '') is not null
    or nullif(trim(coalesce(c.favorite_drink, '')), '') is not null
  );

-- Move DNA-complete clients out of awaiting_dna → meeting
update public.leads l
set status = 'meeting'
from public.clients c
where l.client_id = c.id
  and l.status in ('awaiting_dna', 'dna_sent', 'dna_pending', 'radar_pending', 'new', 'pending_approval')
  and (
    c.onboarding_completed = true
    or c.dna_completed_at is not null
    or c.travel_dna is not null
    or nullif(trim(coalesce(c.dna_interests::text, '')), '') is not null
    or nullif(trim(coalesce(c.favorite_drink, '')), '') is not null
    or nullif(trim(coalesce(c.flight_seat, '')), '') is not null
    or nullif(trim(coalesce(c.hotel_preference, '')), '') is not null
  );
