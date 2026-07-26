-- اختياري — بعد ترحيل البيانات إلى leaders / experts / celebrities
-- يزيل الأعمدة المتفرقة من clients التي تسبب NULLs كثيرة

-- alter table public.clients drop column if exists is_leader;
-- alter table public.clients drop column if exists is_influencer;
-- alter table public.clients drop column if exists platforms;
-- alter table public.clients drop column if exists content_focus;
-- alter table public.clients drop column if exists profile_url;
-- alter table public.clients drop column if exists influencer_followers;
-- alter table public.clients drop column if exists influencer_commission;

-- alter table public.clients drop constraint if exists clients_client_type_check;
-- alter table public.clients add constraint clients_client_type_check check (client_type = 'عميل');

comment on table public.clients is 'عملاء الرحلات فقط — الشركاء في جداول leaders/experts/celebrities';
