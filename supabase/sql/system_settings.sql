-- إعدادات النظام — تفاصيل الحساب البنكي (صف واحد)
create table if not exists public.system_settings (
  id integer primary key default 1 check (id = 1),
  bank_name text,
  account_name text,
  iban text,
  updated_at timestamptz not null default now()
);

comment on table public.system_settings is
  'إعدادات الوكالة العامة — تفاصيل الحساب البنكي لصفحة السداد';

insert into public.system_settings (id, bank_name, account_name, iban)
values (1, null, null, null)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

drop policy if exists "system_settings_select_authenticated" on public.system_settings;
create policy "system_settings_select_authenticated"
  on public.system_settings
  for select
  to authenticated
  using (true);

drop policy if exists "system_settings_update_authenticated" on public.system_settings;
create policy "system_settings_update_authenticated"
  on public.system_settings
  for update
  to authenticated
  using (true)
  with check (true);

grant select, update on public.system_settings to authenticated;
-- Public checkout reads via service_role Server Action (bypass RLS)
