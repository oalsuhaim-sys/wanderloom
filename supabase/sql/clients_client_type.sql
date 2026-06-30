-- نوع جهة الاتصال الموحّد في جدول clients
alter table public.clients
  add column if not exists client_type text not null default 'عميل';

alter table public.clients
  drop constraint if exists clients_client_type_check;

alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('عميل', 'مؤثر', 'ليدر'));

comment on column public.clients.client_type is 'نوع جهة الاتصال: عميل | مؤثر | ليدر';

-- ترحيل البيانات القديمة (إن وُجدت)
update public.clients
set client_type = 'ليدر'
where client_type = 'عميل'
  and coalesce(nullif(trim(ref_code), ''), nullif(trim(referral_code), '')) is not null;
