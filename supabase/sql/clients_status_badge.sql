-- CRM contact status for directory badge (مهتم | جديد | عميل)
-- Run in Supabase SQL Editor.

alter table if exists public.clients
  add column if not exists status text;

comment on column public.clients.status is
  'Directory badge status: مهتم | جديد | عميل (and aliases interested/new/client)';

create index if not exists clients_status_idx
  on public.clients (status)
  where status is not null;
