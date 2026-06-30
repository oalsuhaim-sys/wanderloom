-- أعمدة إطلاق رحلة من ملف العميل (مصدر موحّد للرادار والأرباح)
alter table if exists public.itineraries
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists expected_profit numeric(12, 2) not null default 0;

comment on column public.itineraries.start_date is 'تاريخ بداية الرحلة (من إطلاق رحلة جديدة في CRM)';
comment on column public.itineraries.end_date is 'تاريخ نهاية الرحلة';
comment on column public.itineraries.expected_profit is 'الفائدة / رسوم الخدمة المتوقعة (ر.س)';
