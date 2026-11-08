-- عروض الأسعار: حفظ نسبة الربح ورسوم الخدمة والإجمالي كما أدخلها الموظف.
-- إضافة أعمدة فقط — لا يغيّر أي بيانات. بدونها يبقى الإجمالي صحيحاً (يُحسب من التكلفة + الربح)،
-- لكن عند إعادة فتح العرض قد تظهر «نسبة الربح» مدموجة داخل «رسوم الخدمة».

alter table public.quotations add column if not exists profit_margin numeric;
alter table public.quotations add column if not exists service_fee numeric;
alter table public.quotations add column if not exists grand_total numeric;

comment on column public.quotations.profit_margin is 'نسبة ربح واندرلوم % على التكلفة';
comment on column public.quotations.service_fee is 'رسوم خدمة واندرلوم (مبلغ ثابت)';
comment on column public.quotations.grand_total is 'السعر للعميل = التكلفة + الهامش + رسوم الخدمة';

notify pgrst, 'reload schema';
