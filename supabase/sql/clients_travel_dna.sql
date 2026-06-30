-- ملف التفضيلات الفائقة الشخصية (Travel DNA) لكل عميل — JSONB مرن للحقول الوصفية.

alter table if exists public.clients
  add column if not exists travel_dna jsonb not null default '{}'::jsonb;

comment on column public.clients.travel_dna is 'تفاصيل DNA السياحي: مقعد الطيران، الحساسيات/التغذية، أسلوب الفندق المفضل، مشروبات/قهوة مفضلة، إلخ.';
