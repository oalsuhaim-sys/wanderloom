-- عمود حجم المجموعة لطلبات «رحلات المجموعات» من الموقع العام
alter table public.customers
  add column if not exists group_size int
    check (group_size is null or (group_size > 0 and group_size < 200));
