-- «فصّل الآن» / Tailor Now — instant day-by-day plans built from the places bank.
-- Additive and non-destructive: one new table, nothing existing is altered.
-- Public visitors never touch this table directly; the site reads/writes it server-side
-- (service role) and only by the plan's secret access token. Staff can read/update it from the CRM.

create table if not exists public.tailor_plans (
  id uuid primary key default gen_random_uuid(),
  access_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  full_name text not null,
  phone_wa text not null,
  email text,
  country_id text not null,
  country_label text,
  -- [{ "city": "<bank city label>", "label": "<display label>", "days": 3 }, …] in travel order
  segments jsonb not null default '[]'::jsonb,
  start_date date,
  -- pace, interests, food, lodging, travelers, budget, dream, notes …
  answers jsonb not null default '{}'::jsonb,
  days_total integer not null check (days_total between 1 and 60),
  price_per_day numeric not null,
  total_price numeric not null,
  currency text not null default 'SAR',
  -- preview → receipt_submitted → paid → ready   (failed = generation error, retryable)
  status text not null default 'preview',
  -- generated days: [{ dayNumber, title, city, stops: [...] }, …]
  days jsonb not null default '[]'::jsonb,
  receipt_url text,
  receipt_submitted_at timestamptz,
  paid_at timestamptz,
  paid_by uuid,
  lead_id uuid,
  generation_started_at timestamptz,
  ai_model text,
  -- running token totals: { calls, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd }
  ai_usage jsonb not null default '{}'::jsonb,
  ip_hash text,
  last_error text
);

create index if not exists tailor_plans_created_at_idx on public.tailor_plans (created_at desc);
create index if not exists tailor_plans_phone_idx on public.tailor_plans (phone_wa, created_at desc);
create index if not exists tailor_plans_ip_idx on public.tailor_plans (ip_hash, created_at desc);
create index if not exists tailor_plans_status_idx on public.tailor_plans (status);

comment on table public.tailor_plans is 'خطط «فصّل الآن» — اليوم الأول مجاني وباقي الأيام بعد تأكيد التحويل';

alter table public.tailor_plans enable row level security;

drop policy if exists "tailor_plans_staff_select" on public.tailor_plans;
create policy "tailor_plans_staff_select"
  on public.tailor_plans for select to authenticated
  using (public.is_crm_staff());

drop policy if exists "tailor_plans_staff_update" on public.tailor_plans;
create policy "tailor_plans_staff_update"
  on public.tailor_plans for update to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());
