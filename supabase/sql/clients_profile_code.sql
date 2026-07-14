-- رمز الملف الشخصي الخاص (منفصل عن referral_code و passcode المسار)
alter table public.clients
  add column if not exists profile_code text;

comment on column public.clients.profile_code is
  'رمز الملف الشخصي الخاص — للوصول للمحفظة والبيانات المالية في بوابة العميل (لا يُشارك مع رابط المسار)';

comment on column public.clients.referral_code is
  'كود الإحالة العام — للتسويق والمشاركة الاجتماعية';

-- ربط المسار بعميل CRM (nullable)
alter table public.itineraries
  add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists itineraries_client_id_idx
  on public.itineraries (client_id)
  where client_id is not null;

comment on column public.itineraries.client_id is
  'معرّف العميل المرتبط — عند التعيين يظهر زر الملف الشخصي في بوابة المسار';
