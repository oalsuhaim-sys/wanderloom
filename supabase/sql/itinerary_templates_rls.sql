-- RLS لجدول قوالب المسارات (CRM عبر anon)
alter table if exists public.itinerary_templates enable row level security;

drop policy if exists "itinerary_templates_anon_select" on public.itinerary_templates;
create policy "itinerary_templates_anon_select"
  on public.itinerary_templates
  for select
  to anon, authenticated
  using (true);

drop policy if exists "itinerary_templates_anon_insert" on public.itinerary_templates;
create policy "itinerary_templates_anon_insert"
  on public.itinerary_templates
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "itinerary_templates_anon_update" on public.itinerary_templates;
create policy "itinerary_templates_anon_update"
  on public.itinerary_templates
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "itinerary_templates_anon_delete" on public.itinerary_templates;
create policy "itinerary_templates_anon_delete"
  on public.itinerary_templates
  for delete
  to anon, authenticated
  using (true);
