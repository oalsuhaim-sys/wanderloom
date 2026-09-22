-- Wanderloom AI Travel Concierge — transcripts + clients FK linkage
-- Safe to re-run in Supabase SQL Editor.

create table if not exists public.ai_consultations (
  id uuid primary key default gen_random_uuid(),
  user_phone text,
  user_email text,
  conversation_history jsonb not null default '[]'::jsonb,
  extracted_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy / compatibility columns
alter table public.ai_consultations add column if not exists user_phone text;
alter table public.ai_consultations add column if not exists user_email text;
alter table public.ai_consultations add column if not exists conversation_history jsonb not null default '[]'::jsonb;
alter table public.ai_consultations add column if not exists extracted_preferences jsonb not null default '{}'::jsonb;
alter table public.ai_consultations add column if not exists updated_at timestamptz not null default now();

-- Relational CRM linkage (Mandate 2)
alter table public.ai_consultations add column if not exists client_id bigint;
alter table public.ai_consultations add column if not exists client_name text;
alter table public.ai_consultations add column if not exists client_phone text;
alter table public.ai_consultations add column if not exists destination_interest text;
alter table public.ai_consultations add column if not exists summary text;
alter table public.ai_consultations add column if not exists messages jsonb not null default '[]'::jsonb;
alter table public.ai_consultations add column if not exists source text not null default 'عميل Ai';

-- FK → clients (clients.id is typically integer/bigint)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_consultations_client_id_fkey'
  ) then
    alter table public.ai_consultations
      add constraint ai_consultations_client_id_fkey
      foreign key (client_id) references public.clients (id)
      on delete set null;
  end if;
exception
  when others then
    raise notice 'ai_consultations client_id FK skipped: %', sqlerrm;
end;
$$;

create index if not exists ai_consultations_created_at_idx
  on public.ai_consultations (created_at desc);

create index if not exists ai_consultations_client_id_idx
  on public.ai_consultations (client_id)
  where client_id is not null;

create index if not exists ai_consultations_client_phone_idx
  on public.ai_consultations (client_phone)
  where client_phone is not null and client_phone <> '';

create index if not exists ai_consultations_user_phone_idx
  on public.ai_consultations (user_phone)
  where user_phone is not null and user_phone <> '';

create index if not exists ai_consultations_user_email_idx
  on public.ai_consultations (user_email)
  where user_email is not null and user_email <> '';

create or replace function public.ai_consultations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_consultations_updated_at on public.ai_consultations;
create trigger ai_consultations_updated_at
  before update on public.ai_consultations
  for each row
  execute function public.ai_consultations_set_updated_at();

alter table public.ai_consultations enable row level security;

drop policy if exists "ai_consultations_service_read" on public.ai_consultations;
drop policy if exists "ai_consultations_crm_select" on public.ai_consultations;

create policy "ai_consultations_crm_select"
  on public.ai_consultations
  for select
  to authenticated
  using (true);

comment on table public.ai_consultations is
  'AI Travel Concierge transcripts linked to clients for CRM / marketing.';
comment on column public.ai_consultations.client_id is
  'FK to public.clients — find-or-create by phone/email from concierge chat.';
comment on column public.ai_consultations.messages is
  'Canonical chat transcript (mirrors conversation_history for compatibility).';
