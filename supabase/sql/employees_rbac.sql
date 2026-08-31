-- RBAC على جدول employees (الجدول الفعلي في CRM)

alter table public.employees
  add column if not exists is_admin boolean not null default false;

alter table public.employees
  add column if not exists is_suspended boolean not null default false;

alter table public.employees
  add column if not exists permissions jsonb not null default '[]'::jsonb;

-- ملاحظة: العمود يخزّن مصفوفة مفاتيح مفعّلة مثل:
-- ["view_dashboard","access_inbox","can_access_dashboard"]
-- وليس كائن boolean map.

alter table public.employees
  add column if not exists can_access_dashboard boolean;

alter table public.employees
  add column if not exists can_access_clients boolean;

alter table public.employees
  add column if not exists can_access_itineraries boolean;

alter table public.employees
  add column if not exists can_access_marketing boolean;

alter table public.employees
  add column if not exists can_access_payments boolean;

-- ترقية المديرين الحاليين
update public.employees
set
  is_admin = true,
  permissions = '["can_access_dashboard","can_access_clients","can_access_itineraries","can_access_marketing","can_access_payments","view_dashboard","access_inbox","access_appointments","access_group_operations","access_itineraries_view","access_itineraries_edit","access_wallet"]'::jsonb,
  can_access_dashboard = true,
  can_access_clients = true,
  can_access_itineraries = true,
  can_access_marketing = true,
  can_access_payments = true
where lower(trim(coalesce(role, ''))) = 'admin'
  and is_admin = false;
