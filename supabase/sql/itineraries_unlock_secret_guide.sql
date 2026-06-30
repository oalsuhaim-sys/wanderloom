-- فتح الدليل السري للوجهة (VIP) — اختياري لكل مسار
alter table public.itineraries
  add column if not exists unlock_secret_guide boolean not null default false;

comment on column public.itineraries.unlock_secret_guide is 'عند true يُسمح بعرض دليل سري/VIP للعميل في تجربة الرحلة';
