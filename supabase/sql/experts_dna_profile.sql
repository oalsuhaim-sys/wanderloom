-- بصمة الخبير (Expert DNA) — نفّذ في Supabase SQL Editor
alter table public.experts
  add column if not exists dna_profile jsonb not null default '{}'::jsonb;

comment on column public.experts.dna_profile is
  'بصمة الخبير: routing_style, unique_advantages, company_alignment, notes, submitted_at';
