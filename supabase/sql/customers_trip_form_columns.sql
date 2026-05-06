-- توسيع جدول customers لنموذج «تصميم الرحلة» على الموقع العام
-- نفّذ بعد customers_leads.sql إن كان الجدول موجوداً مسبقاً.

alter table public.customers
  add column if not exists trip_form jsonb not null default '{}'::jsonb;

alter table public.customers
  add column if not exists travel_days int;

alter table public.customers
  add column if not exists travel_start_date date;

alter table public.customers
  add column if not exists dream_closing text;

-- إن كان عمود destination_dream مطلوباً بلا قيمة قديمة، يبقى كما هو؛ النموذج الجديد يملأه تلقائياً بملخص.
