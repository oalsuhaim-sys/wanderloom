-- تأكد أن CRM يستطيع قراءة/تعديل quotations (anon + authenticated)
-- نفّذ في Supabase SQL Editor إذا كان .eq('id', …) يُرجع null بدون خطأ (RLS)

alter table if exists public.quotations enable row level security;

drop policy if exists "quotations_crm_select" on public.quotations;
create policy "quotations_crm_select"
  on public.quotations for select
  to anon, authenticated
  using (true);

drop policy if exists "quotations_crm_insert" on public.quotations;
create policy "quotations_crm_insert"
  on public.quotations for insert
  to anon, authenticated
  with check (true);

drop policy if exists "quotations_crm_update" on public.quotations;
create policy "quotations_crm_update"
  on public.quotations for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "quotations_crm_delete" on public.quotations;
create policy "quotations_crm_delete"
  on public.quotations for delete
  to anon, authenticated
  using (true);
