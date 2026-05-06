-- جدول الفنادق لإدارة CRM (أسماء، مواقع، تصنيف، روابط، ملاحظات)
-- نفّذ السكربت في SQL Editor في Supabase.

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  city text not null default '',
  category text not null
    constraint hotels_category_check
      check (category in (
        'ultra_luxury',
        'boutique_design',
        'apartments_luxe',
        'smart_choice'
      )),
  booking_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists hotels_country_idx on public.hotels (country);
create index if not exists hotels_name_idx on public.hotels (name);

comment on table public.hotels is 'فنادق مرجعية لفريق Wanderloom (CRM)';
comment on column public.hotels.category is 'ultra_luxury | boutique_design | apartments_luxe | smart_choice';
comment on column public.hotels.booking_url is 'رابط Booking أو الموقع الرسمي';

alter table public.hotels enable row level security;

-- يطابق نمط الجداول الداخلية في CRM (عميل anon من المتصفح).
-- راجع سياساتك الأمنية؛ للإنتاج يُفضّل مصادقة + سياسات أضيق.
drop policy if exists "hotels_anon_all" on public.hotels;
create policy "hotels_anon_all"
  on public.hotels
  for all
  to anon
  using (true)
  with check (true);
