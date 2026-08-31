-- Client activity timeline — references public.clients(id)
-- Run once in Supabase SQL Editor. Safe to re-run.

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients (id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'note'
    check (
      type in (
        'note',
        'payment',
        'invoice',
        'booking',
        'trip',
        'quote',
        'meeting',
        'contact',
        'other'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create index if not exists activity_logs_client_created_idx
  on public.activity_logs (client_id, created_at desc);

create index if not exists activity_logs_type_idx
  on public.activity_logs (type);

alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_authenticated_all on public.activity_logs;
create policy activity_logs_authenticated_all
  on public.activity_logs for all to authenticated
  using (true) with check (true);

comment on table public.activity_logs is
  'Customer activity timeline for CRM client 360 — client_id → clients.id';
