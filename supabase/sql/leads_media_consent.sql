-- Photography / marketing media consent captured at group onboarding terms submit
alter table public.leads
  add column if not exists media_consent boolean;

comment on column public.leads.media_consent is
  'Client opt-in/out for promotional photography — set at terms agreement submit';
