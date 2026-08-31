-- جدول الدول النشطة — مصدر موحّد لكل محدّدات الوجهة في الموقع

create table if not exists public.countries (
  id text primary key,
  name_ar text not null,
  name_en text,
  flag text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists countries_active_sort_idx
  on public.countries (is_active, sort_order);

alter table public.countries enable row level security;

drop policy if exists countries_public_read on public.countries;
create policy countries_public_read
  on public.countries
  for select
  to anon, authenticated
  using (is_active = true);

insert into public.countries (id, name_ar, flag, sort_order, is_active)
values
  ('indonesia', 'إندونيسيا', '🇮🇩', 1, true),
  ('japan', 'اليابان', '🇯🇵', 2, true),
  ('south_korea', 'كوريا الجنوبية', '🇰🇷', 3, true),
  ('china', 'الصين', '🇨🇳', 4, true),
  ('canada', 'كندا', '🇨🇦', 5, true),
  ('south_africa', 'جنوب أفريقيا', '🇿🇦', 6, true),
  ('germany', 'ألمانيا', '🇩🇪', 7, true),
  ('spain', 'إسبانيا', '🇪🇸', 8, true),
  ('italy', 'إيطاليا', '🇮🇹', 9, true),
  ('france', 'فرنسا', '🇫🇷', 10, true),
  ('uk', 'بريطانيا', '🇬🇧', 11, true),
  ('usa', 'أمريكا', '🇺🇸', 12, true),
  ('portugal', 'البرتغال', '🇵🇹', 13, true),
  ('belgium', 'بلجيكا', '🇧🇪', 14, true),
  ('netherlands', 'هولندا', '🇳🇱', 15, true),
  ('czech', 'التشيك', '🇨🇿', 16, true),
  ('poland', 'بولندا', '🇵🇱', 17, true),
  ('austria', 'النمسا', '🇦🇹', 18, true),
  ('sweden', 'السويد', '🇸🇪', 19, true),
  ('russia', 'روسيا', '🇷🇺', 20, true),
  ('hungary', 'المجر', '🇭🇺', 21, true),
  ('switzerland', 'سويسرا', '🇨🇭', 22, true)
on conflict (id) do update set
  name_ar = excluded.name_ar,
  flag = excluded.flag,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
