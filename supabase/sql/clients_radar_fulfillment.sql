-- حالة تنفيذ طلبات القروب في الرادار الحي

alter table if exists public.clients
  add column if not exists radar_fulfillment_status text not null default 'بانتظار التنفيذ';

comment on column public.clients.radar_fulfillment_status is
  'تنفيذ طلبات القروب في الرادار: بانتظار التنفيذ | تم التنفيذ';

create index if not exists clients_radar_fulfillment_status_idx
  on public.clients (radar_fulfillment_status)
  where radar_fulfillment_status is not null and radar_fulfillment_status <> '';
