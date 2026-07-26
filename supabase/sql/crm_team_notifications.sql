-- إشعارات داخلية للفريق (خبير / ليدر / إدارة) عند تسجيل عميل جديد

create table if not exists public.crm_team_notifications (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('expert', 'leader', 'admin', 'ops')),
  title text not null,
  message text not null,
  link text null,
  client_id bigint null,
  lead_id uuid null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists crm_team_notifications_role_created_idx
  on public.crm_team_notifications (role, created_at desc);

create index if not exists crm_team_notifications_unread_idx
  on public.crm_team_notifications (role)
  where read_at is null;

comment on table public.crm_team_notifications is
  'إشعارات تسجيل العملاء الجدد وإرسال رابط DNA للخبير والليدر';

alter table public.crm_team_notifications enable row level security;

drop policy if exists "crm_team_notifications_select_authenticated" on public.crm_team_notifications;
create policy "crm_team_notifications_select_authenticated"
  on public.crm_team_notifications
  for select
  to authenticated
  using (true);

drop policy if exists "crm_team_notifications_update_authenticated" on public.crm_team_notifications;
create policy "crm_team_notifications_update_authenticated"
  on public.crm_team_notifications
  for update
  to authenticated
  using (true)
  with check (true);

-- inserts via service_role (admin client) bypass RLS
grant select, update on public.crm_team_notifications to authenticated;
