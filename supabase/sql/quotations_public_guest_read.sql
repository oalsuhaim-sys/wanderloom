-- Safety net for public quotation brochures (/proposal/[id]).
-- Primary path: GET /api/proposals/[id] via service_role (bypasses RLS).

alter table if exists public.quotations enable row level security;

drop policy if exists "quotations_public_select_by_id" on public.quotations;
create policy "quotations_public_select_by_id"
  on public.quotations
  for select
  to anon, authenticated
  using (true);

comment on policy "quotations_public_select_by_id" on public.quotations is
  'Allows brochure reads; public page prefers service_role API.';
