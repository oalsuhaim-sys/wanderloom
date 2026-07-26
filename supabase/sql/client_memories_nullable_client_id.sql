-- Allow client portal uploads before client_id is assigned in CRM inbox workflow
alter table public.client_memories
  alter column client_id drop not null;

alter table public.client_memories
  add column if not exists notes text;

comment on column public.client_memories.client_id is
  'Nullable for inbox uploads from /api/client-upload; CRM can assign later.';
