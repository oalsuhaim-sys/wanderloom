-- Influencer referral code (optional at entry; auto-generated when blank)
-- Run in Supabase SQL Editor.

alter table public.influencers
  add column if not exists referral_code text;

create unique index if not exists influencers_referral_code_uidx
  on public.influencers (referral_code)
  where referral_code is not null and referral_code <> '';

comment on column public.influencers.referral_code is 'Affiliate code (WNDR-XXXXX) — public join link ?ref=';
