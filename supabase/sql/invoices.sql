-- فواتير تأكيد الحجز (عربون / مبلغ كامل) بعد اعتماد عرض السعر
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id bigint references public.clients (id) on delete set null,
  quote_id text not null,
  trip_title text not null default '',
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('deposit', 'full')),
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

comment on table public.invoices is 'طلبات دفع لتأكيد الحجز بعد اعتماد عرض السعر';
comment on column public.invoices.quote_id is 'معرّف quotations.id كنص (bigint أو uuid)';
comment on column public.invoices.type is 'deposit = عربون · full = مبلغ كامل';
comment on column public.invoices.status is 'pending | paid';

create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_quote_id_idx on public.invoices (quote_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_created_at_idx on public.invoices (created_at desc);

alter table public.invoices enable row level security;

-- قراءة عامة لصفحة العميل /invoice/[id]
drop policy if exists "invoices_public_select" on public.invoices;
create policy "invoices_public_select"
  on public.invoices for select
  to anon, authenticated
  using (true);

-- كتابة CRM (anon/authenticated — يُفضّل service_role من الخادم)
drop policy if exists "invoices_crm_insert" on public.invoices;
create policy "invoices_crm_insert"
  on public.invoices for insert
  to anon, authenticated
  with check (true);

drop policy if exists "invoices_crm_update" on public.invoices;
create policy "invoices_crm_update"
  on public.invoices for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "invoices_crm_delete" on public.invoices;
create policy "invoices_crm_delete"
  on public.invoices for delete
  to anon, authenticated
  using (true);
