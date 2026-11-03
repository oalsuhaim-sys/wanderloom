-- متابعات الرحلة النشطة — On-Trip Follow-up logs

create table if not exists public.client_followups (
  id uuid primary key default gen_random_uuid(),
  client_id bigint not null references public.clients (id) on delete cascade,
  agent_name text not null,
  agent_employee_id uuid null references public.employees (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint client_followups_agent_name_check
    check (char_length(trim(agent_name)) > 0)
);

create index if not exists client_followups_client_created_idx
  on public.client_followups (client_id, created_at desc);

create index if not exists client_followups_created_day_idx
  on public.client_followups (created_at desc);

comment on table public.client_followups is
  'سجل متابعات الموظفين للعملاء أثناء الرحلة النشطة (تم التواصل اليوم)';

alter table public.client_followups enable row level security;

drop policy if exists "client_followups_select_authenticated" on public.client_followups;
create policy "client_followups_select_authenticated"
  on public.client_followups
  for select
  to authenticated
  using (true);

drop policy if exists "client_followups_insert_authenticated" on public.client_followups;
create policy "client_followups_insert_authenticated"
  on public.client_followups
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "client_followups_delete_own_or_admin" on public.client_followups;
create policy "client_followups_delete_own_or_admin"
  on public.client_followups
  for delete
  to authenticated
  using (
    (
      agent_employee_id is not null
      and exists (
        select 1 from public.employees e
        where e.id = agent_employee_id and e.user_id = auth.uid()
      )
    )
    or public.is_crm_admin()
  );

grant select, insert, delete on public.client_followups to authenticated;
