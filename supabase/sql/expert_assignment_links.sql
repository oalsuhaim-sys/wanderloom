-- Link experts to confirmed itineraries and quotations.
-- This migration adds linkage only; it does not change either workflow.

alter table if exists public.itineraries
  add column if not exists expert_id uuid;

alter table if exists public.quotations
  add column if not exists expert_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itineraries_expert_id_fkey'
      and conrelid = 'public.itineraries'::regclass
  ) then
    alter table public.itineraries
      add constraint itineraries_expert_id_fkey
      foreign key (expert_id)
      references public.experts (id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotations_expert_id_fkey'
      and conrelid = 'public.quotations'::regclass
  ) then
    alter table public.quotations
      add constraint quotations_expert_id_fkey
      foreign key (expert_id)
      references public.experts (id)
      on delete set null;
  end if;
end $$;

create index if not exists itineraries_expert_id_idx
  on public.itineraries (expert_id);

create index if not exists quotations_expert_id_idx
  on public.quotations (expert_id);

comment on column public.itineraries.expert_id is
  'Destination expert assigned to this itinerary.';

comment on column public.quotations.expert_id is
  'Destination expert assigned to this quotation.';
