-- كود الإحالة من ?ref= في نموذج «سجّل رحلتك»
alter table if exists public.leads
  add column if not exists referral_code text;

comment on column public.leads.referral_code is 'كود الإحالة من رابط ?ref= (برنامج الشركاء)';

create index if not exists leads_referral_code_idx
  on public.leads (referral_code)
  where referral_code is not null and referral_code <> '';
