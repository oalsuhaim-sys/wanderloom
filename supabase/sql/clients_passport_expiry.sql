-- تاريخ انتهاء جواز العميل — للرادار وتنبيهات CRM
alter table if exists public.clients
  add column if not exists passport_expiry date;

comment on column public.clients.passport_expiry is 'تاريخ انتهاء جواز السفر — يُحدَّث من ملف العميل VIP';
