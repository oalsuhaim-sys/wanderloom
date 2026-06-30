-- رحلات المجموعات — محتوى ثنائي اللغة للصفحة العامة
create table if not exists public.group_trips (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  title_en text not null,
  description_ar text not null,
  description_en text not null,
  badge_ar text not null default 'مجموعة',
  badge_en text not null default 'Group',
  dates_ar text not null default '',
  dates_en text not null default '',
  price text not null default '',
  includes_ar text not null default '',
  includes_en text not null default '',
  excludes_ar text not null default '',
  excludes_en text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  max_seats integer not null default 0,
  allow_waitlist boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.group_trips enable row level security;

drop policy if exists "group_trips_anon_select" on public.group_trips;
create policy "group_trips_anon_select"
  on public.group_trips for select
  to anon, authenticated
  using (is_active = true);

-- CRM: قراءة كل الصفوف (بما فيها المخفية) — الصفحة العامة تفلتر is_active
drop policy if exists "group_trips_crm_select_all" on public.group_trips;
create policy "group_trips_crm_select_all"
  on public.group_trips for select
  to anon, authenticated
  using (true);

-- CRM (نفس مفتاح anon) — إدراج / تعديل / حذف
drop policy if exists "group_trips_anon_insert" on public.group_trips;
create policy "group_trips_anon_insert"
  on public.group_trips for insert
  to anon, authenticated
  with check (true);

drop policy if exists "group_trips_anon_update" on public.group_trips;
create policy "group_trips_anon_update"
  on public.group_trips for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "group_trips_anon_delete" on public.group_trips;
create policy "group_trips_anon_delete"
  on public.group_trips for delete
  to anon, authenticated
  using (true);

-- بذور أولية (تطابق البطاقات السابقة) — تُنفَّذ مرة واحدة عند الجدول الفارغ
insert into public.group_trips (
  title_ar, title_en, description_ar, description_en, badge_ar, badge_en, sort_order
)
select * from (values
  (
    'رحلة عائلية لليابان',
    'Family Trip to Japan',
    'مسار يضع راحة العائلة والتنوّع في المقدمة: أنشطة مناسبة للصغار والكبار، وتوقيتات مرنة.',
    'A route that puts family comfort and variety first: activities for all ages and flexible timing.',
    'مجموعة',
    'Group',
    1
  ),
  (
    'رحلة أصدقاء لكوريا',
    'Friends Trip to Korea',
    'للمجموعات التي تحب الطاقة الحضرية والثقافة البصرية: سيول، طعام شارع، وصور لا تُنسى.',
    'For groups who love urban energy and visual culture: Seoul, street food, and unforgettable photos.',
    'مجموعة',
    'Group',
    2
  ),
  (
    'رحلة عمل لأوروبا',
    'Business Trip to Europe',
    'لفرق العمل والوفود: جدول محكم، فنادق مناسبة للاجتماعات، ومساحات للتوازن بين العمل والاستكشاف.',
    'For work teams and delegations: a tight schedule, meeting-friendly hotels, and space to balance work and exploration.',
    'مجموعة',
    'Group',
    3
  )) as seed(title_ar, title_en, description_ar, description_en, badge_ar, badge_en, sort_order)
where not exists (select 1 from public.group_trips limit 1);
