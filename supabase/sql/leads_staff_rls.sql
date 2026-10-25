-- Radar / CRM read leads with the signed-in employee's session (authenticated role).
-- RLS is enabled on public.leads but only a DELETE policy remained, so staff saw 0 rows
-- while the notification bell (service role) still counted new requests.
-- Additive & non-destructive: grants SELECT / INSERT / UPDATE to active employees only.

create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and coalesce(e.is_suspended, false) = false
  );
$$;

revoke all on function public.is_crm_staff() from public, anon;
grant execute on function public.is_crm_staff() to authenticated;

drop policy if exists "leads_staff_select" on public.leads;
create policy "leads_staff_select"
  on public.leads for select to authenticated
  using (public.is_crm_staff());

drop policy if exists "leads_staff_insert" on public.leads;
create policy "leads_staff_insert"
  on public.leads for insert to authenticated
  with check (public.is_crm_staff());

drop policy if exists "leads_staff_update" on public.leads;
create policy "leads_staff_update"
  on public.leads for update to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());
