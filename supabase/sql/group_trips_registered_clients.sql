-- مسجّلو رحلة القروب (حتى 10 عملاء CRM) لميزة التطابق البشري
alter table if exists public.group_trips
  add column if not exists registered_client_ids integer[] not null default '{}';

comment on column public.group_trips.registered_client_ids is 'معرّفات العملاء المسجّلين في الرحلة (حد أقصى 10) — Fellowship Matching';

create index if not exists group_trips_registered_client_ids_gin
  on public.group_trips using gin (registered_client_ids);
