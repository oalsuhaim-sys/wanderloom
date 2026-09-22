-- OTP challenges for AI Concierge phone verification
create table if not exists public.ai_concierge_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  client_name text not null default '',
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_concierge_otps_phone_created_idx
  on public.ai_concierge_otps (phone, created_at desc);

alter table public.ai_consultations
  add column if not exists verified_at timestamptz;

alter table public.ai_concierge_otps enable row level security;

drop policy if exists "ai_concierge_otps_no_public" on public.ai_concierge_otps;
-- Service role bypasses RLS; no public policies.

comment on table public.ai_concierge_otps is
  'Hashed OTP codes for Wanderloom AI Concierge WhatsApp verification.';
