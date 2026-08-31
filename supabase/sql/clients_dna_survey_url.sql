-- Optional: persist generated DNA survey URL on clients
-- Safe to re-run.

alter table public.clients
  add column if not exists dna_survey_url text;

comment on column public.clients.dna_survey_url is
  'رابط استبيان Travel DNA المولَّد عند قبول الطلب من الرادار';
