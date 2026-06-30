-- أعمدة ملف VIP Client DNA (بالإضافة إلى travel_dna و name / phone_wa للتوافق).

alter table if exists public.clients
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists flight_preferences text,
  add column if not exists hotel_preferences text,
  add column if not exists dietary text,
  add column if not exists secret_notes text;

comment on column public.clients.full_name is 'اسم العميل VIP (مرآة لـ name عند الحاجة)';
comment on column public.clients.phone_number is 'هاتف العميل (مرآة لـ phone_wa عند الحاجة)';
comment on column public.clients.flight_preferences is 'تفضيلات الطيران';
comment on column public.clients.hotel_preferences is 'تفضيلات الفنادق';
comment on column public.clients.dietary is 'التغذية والحساسية';
comment on column public.clients.secret_notes is 'ملاحظات سرية للفريق فقط';
