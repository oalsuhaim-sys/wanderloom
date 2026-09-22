-- Manageable dropdown options for Content Generator
create table if not exists public.marketing_generator_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'audience',
      'format',
      'platform',
      'destination',
      'philosophy',
      'funnel_stage'
    )
  ),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, label)
);

create index if not exists marketing_generator_options_category_idx
  on public.marketing_generator_options (category, sort_order, is_active);

alter table public.marketing_generator_options enable row level security;

drop policy if exists "marketing_generator_options_read" on public.marketing_generator_options;
create policy "marketing_generator_options_read"
  on public.marketing_generator_options for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "marketing_generator_options_crm_all" on public.marketing_generator_options;
create policy "marketing_generator_options_crm_all"
  on public.marketing_generator_options for all
  to authenticated
  using (true) with check (true);

-- Seed defaults (idempotent)
insert into public.marketing_generator_options (category, label, sort_order)
values
  ('audience', 'مسافرون لأول مرة', 0),
  ('audience', 'المجموعة النسائية', 1),
  ('audience', 'عشاق الهدوء والتأمل', 2),
  ('format', 'السرد الصوتي على الأرشيف', 0),
  ('format', 'المقارنة البصرية Split-Screen', 1),
  ('format', 'الاستوديو + الكتاب', 2),
  ('format', 'التفكيك المالي بالجرافيك', 3),
  ('format', 'POV الحسّي', 4),
  ('format', 'السلاسل التفاعلية', 5),
  ('platform', 'إنستقرام', 0),
  ('platform', 'يوتيوب', 1),
  ('platform', 'تيك توك / شورتس', 2),
  ('platform', 'منصة X', 3),
  ('destination', 'كوريا', 0),
  ('destination', 'اليابان', 1),
  ('destination', 'روسيا', 2),
  ('destination', 'أخرى', 3),
  ('philosophy', 'تلقائي حسب الصيغة —', 0),
  ('philosophy', 'بيع الشعور', 1),
  ('philosophy', 'هندسة الهدوء', 2),
  ('funnel_stage', 'الوعي', 0),
  ('funnel_stage', 'الاهتمام', 1),
  ('funnel_stage', 'التحويل', 2)
on conflict (category, label) do update
set
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
