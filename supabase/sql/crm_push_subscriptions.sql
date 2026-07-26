-- اشتراكات Web Push لإشعارات نقاشات الفريق (CRM PWA)

create table if not exists public.crm_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid null references auth.users (id) on delete set null,
  employee_id uuid null references public.employees (id) on delete set null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_push_subscriptions_user_idx
  on public.crm_push_subscriptions (user_id);

create index if not exists crm_push_subscriptions_employee_idx
  on public.crm_push_subscriptions (employee_id);

comment on table public.crm_push_subscriptions is
  'اشتراكات متصفح Web Push لإشعارات نظام التشغيل عند رسائل نقاش الفريق';

alter table public.crm_push_subscriptions enable row level security;

drop policy if exists "crm_push_subscriptions_select_own" on public.crm_push_subscriptions;
create policy "crm_push_subscriptions_select_own"
  on public.crm_push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crm_push_subscriptions_insert_own" on public.crm_push_subscriptions;
create policy "crm_push_subscriptions_insert_own"
  on public.crm_push_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "crm_push_subscriptions_update_own" on public.crm_push_subscriptions;
create policy "crm_push_subscriptions_update_own"
  on public.crm_push_subscriptions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_push_subscriptions_delete_own" on public.crm_push_subscriptions;
create policy "crm_push_subscriptions_delete_own"
  on public.crm_push_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.crm_push_subscriptions to authenticated;
-- service_role (admin client) bypasses RLS for broadcast sends
