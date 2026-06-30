-- سعة الرحلة وقائمة الانتظار
alter table public.group_trips
  add column if not exists max_seats integer not null default 0,
  add column if not exists allow_waitlist boolean not null default true;
