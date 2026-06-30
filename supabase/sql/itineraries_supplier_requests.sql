-- طلبات الموردين الخارجية (فنادق، هدايا، كونسيرج)
alter table public.itineraries
  add column if not exists supplier_requests jsonb not null default '[]'::jsonb;

comment on column public.itineraries.supplier_requests is
  'مصفوفة JSON: [{ id, title, details, status, supplier_phone? }] — دورة: pending_reply → confirmed_unpaid → paid';
