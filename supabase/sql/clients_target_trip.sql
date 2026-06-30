-- الرحلة المستهدفة لمسار المبيعات / القروبات (جدول clients)

alter table if exists public.clients
  add column if not exists target_trip text;

comment on column public.clients.target_trip is
  'الرحلة أو القروب المستهدف (مثل: قروب بالي) — يظهر كشارة على بطاقة العميل';

create index if not exists clients_target_trip_idx
  on public.clients (target_trip)
  where target_trip is not null and target_trip <> '';
