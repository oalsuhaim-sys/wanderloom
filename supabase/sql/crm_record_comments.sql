-- نقاشات الفريق الداخلية على سجلات الـ CRM (مسارات، شركاء، …)

create table if not exists public.crm_record_comments (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id text not null,
  author_employee_id uuid null references public.employees (id) on delete set null,
  author_user_id uuid null references auth.users (id) on delete set null,
  author_name text not null,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_record_comments_record_type_check
    check (char_length(trim(record_type)) > 0),
  constraint crm_record_comments_record_id_check
    check (char_length(trim(record_id)) > 0),
  constraint crm_record_comments_body_check
    check (char_length(trim(body)) > 0)
);

create index if not exists crm_record_comments_record_idx
  on public.crm_record_comments (record_type, record_id, created_at asc);

create index if not exists crm_record_comments_author_idx
  on public.crm_record_comments (author_employee_id);

comment on table public.crm_record_comments is
  'تعليقات تعاون داخلية مربوطة بسجل CRM عبر record_type + record_id';

alter table public.crm_record_comments enable row level security;

drop policy if exists "crm_record_comments_select_authenticated" on public.crm_record_comments;
create policy "crm_record_comments_select_authenticated"
  on public.crm_record_comments
  for select
  to authenticated
  using (true);

drop policy if exists "crm_record_comments_insert_authenticated" on public.crm_record_comments;
create policy "crm_record_comments_insert_authenticated"
  on public.crm_record_comments
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "crm_record_comments_delete_own_or_admin" on public.crm_record_comments;
create policy "crm_record_comments_delete_own_or_admin"
  on public.crm_record_comments
  for delete
  to authenticated
  using (
    author_user_id = auth.uid()
    or public.is_crm_admin()
  );

grant select, insert, delete on public.crm_record_comments to authenticated;
