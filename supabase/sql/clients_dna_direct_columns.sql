-- أعمدة DNA المباشرة — تدفق من نموذج التعارف العام إلى بطاقة العميل في CRM
alter table if exists public.clients
  add column if not exists flight_seat text,
  add column if not exists food_allergies text,
  add column if not exists favorite_drink text,
  add column if not exists hotel_preference text;

comment on column public.clients.flight_seat is 'المقعد المفضل في الطيران — من نموذج DNA العام';
comment on column public.clients.food_allergies is 'الحساسية أو تفضيلات الطعام';
comment on column public.clients.favorite_drink is 'المشروب / القهوة المفضلة';
comment on column public.clients.hotel_preference is 'نوع الفنادق المفضلة';
