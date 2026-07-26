-- بصمة الشريك (Partner DNA) — نفّذ في Supabase SQL Editor
-- يضيف dna_profile للقادة والمشاهير (الخبراء لديهم العمود مسبقاً عبر experts_dna_profile.sql)

alter table public.leaders
  add column if not exists dna_profile jsonb not null default '{}'::jsonb;

alter table public.celebrities
  add column if not exists dna_profile jsonb not null default '{}'::jsonb;

alter table public.experts
  add column if not exists dna_profile jsonb not null default '{}'::jsonb;

comment on column public.leaders.dna_profile is
  'بصمة الشريك: trip_style, strengths, competitive_advantage, agency_requirements, submitted_at';

comment on column public.celebrities.dna_profile is
  'بصمة الشريك: trip_style, strengths, competitive_advantage, agency_requirements, submitted_at';

comment on column public.experts.dna_profile is
  'بصمة الشريك/الخبير: يدعم حقول partner DNA وحقول Expert DNA السابقة';
