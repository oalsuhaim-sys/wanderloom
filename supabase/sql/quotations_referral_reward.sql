-- مكافآت الإحالة عند اعتماد/تأكيد عرض السعر

alter table if exists public.quotations
  add column if not exists referral_code text;

alter table if exists public.quotations
  add column if not exists is_referral_paid boolean not null default false;

comment on column public.quotations.referral_code is 'كود الإحالة المستخدم لهذا العرض (إن وُجد)';
comment on column public.quotations.is_referral_paid is 'هل تم صرف مكافأة الإحالة (500 ر.س) للمُحيل؟';

create index if not exists quotations_referral_code_idx
  on public.quotations (referral_code)
  where referral_code is not null and referral_code <> '';

-- كود الإحالة الذي استخدمه العميل عند التسجيل (اختياري)
alter table if exists public.clients
  add column if not exists used_code text;

comment on column public.clients.used_code is 'كود الإحالة الذي استخدمه هذا العميل عند الانضمام';

create index if not exists clients_used_code_idx
  on public.clients (used_code)
  where used_code is not null and used_code <> '';
