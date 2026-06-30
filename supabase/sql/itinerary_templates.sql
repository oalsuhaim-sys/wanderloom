-- قوالب المسارات — نسخ أيام ووجهة قابلة لإعادة الاستخدام
create table if not exists public.itinerary_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  days_data jsonb not null default '[]'::jsonb,
  hotel_details jsonb,
  source_itinerary_id bigint references public.itineraries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists itinerary_templates_created_at_idx
  on public.itinerary_templates (created_at desc);

comment on table public.itinerary_templates is 'قوالب مسارات VIP — أيام + وجهة للاستدعاء من محرر المسار';
