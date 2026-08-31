-- Default Expert & Leader commission: 15% of profit margin (price − cost)
-- Run in Supabase SQL Editor

alter table public.leaders
  add column if not exists commission_rate numeric(5, 2) not null default 15;

alter table public.experts
  add column if not exists commission_rate numeric(5, 2) not null default 15;

alter table public.experts
  add column if not exists referral_code text;

comment on column public.leaders.commission_rate is
  'نسبة عمولة القائد من هامش الربح % — الافتراضي 15';

comment on column public.experts.commission_rate is
  'نسبة عمولة خبير الوجهة من هامش الربح % — الافتراضي 15';

comment on column public.experts.referral_code is
  'كود إحالة الخبير (اختياري)';

-- Backfill nulls (if column existed without default)
update public.leaders
set commission_rate = 15
where commission_rate is null;

update public.experts
set commission_rate = 15
where commission_rate is null;

create unique index if not exists experts_referral_code_idx
  on public.experts (referral_code)
  where referral_code is not null;
