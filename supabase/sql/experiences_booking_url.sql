alter table public.experiences
  add column if not exists booking_url text;

comment on column public.experiences.booking_url is 'رابط حجز التجربة (يفتح للعميل/الموظف)';
