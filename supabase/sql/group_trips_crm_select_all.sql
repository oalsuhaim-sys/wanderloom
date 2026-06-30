-- يسمح لـ CRM بقراءة الرحلات المخفية (is_active = false)
-- الصفحة العامة تفلتر .eq('is_active', true) في GroupTripsSection

drop policy if exists "group_trips_crm_select_all" on public.group_trips;
create policy "group_trips_crm_select_all"
  on public.group_trips for select
  to anon, authenticated
  using (true);
