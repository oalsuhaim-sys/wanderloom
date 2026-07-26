-- Wanderloom — Operational Partner Expansion
-- نفّذ هذا الملف كاملاً في Supabase SQL Editor بعد أخذ نسخة احتياطية.
-- يعتمد على وجود الجداول: clients, itineraries, leaders, experts.

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) LEADER FEATURES
-- ============================================================================

-- 360° Feedback: تقييم قائد الرحلة للعميل بعد الرحلة
create table if not exists public.client_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id integer not null references public.clients (id) on delete cascade,
  leader_id uuid not null references public.leaders (id) on delete cascade,
  trip_id bigint not null references public.itineraries (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists client_reviews_client_id_idx
  on public.client_reviews (client_id, created_at desc);
create index if not exists client_reviews_leader_id_idx
  on public.client_reviews (leader_id, created_at desc);
create index if not exists client_reviews_trip_id_idx
  on public.client_reviews (trip_id);

-- Availability Calendar: فترات تفرغ قائد الرحلة
create table if not exists public.leader_availability (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.leaders (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status varchar(30) not null default 'available',
  constraint leader_availability_date_range_check
    check (end_date >= start_date),
  constraint leader_availability_status_check
    check (status in ('available', 'unavailable', 'booked'))
);

create index if not exists leader_availability_leader_dates_idx
  on public.leader_availability (leader_id, start_date, end_date);
create index if not exists leader_availability_status_idx
  on public.leader_availability (status, start_date);

-- Live Trip Log: يوميات وملاحظات الرحلة المباشرة
create table if not exists public.trip_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id bigint not null references public.itineraries (id) on delete cascade,
  leader_id uuid not null references public.leaders (id) on delete cascade,
  log_text text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint trip_logs_content_check
    check (
      nullif(btrim(log_text), '') is not null
      or nullif(btrim(image_url), '') is not null
    )
);

create index if not exists trip_logs_trip_id_idx
  on public.trip_logs (trip_id, created_at desc);
create index if not exists trip_logs_leader_id_idx
  on public.trip_logs (leader_id, created_at desc);

-- ============================================================================
-- 2) EXPERT FEATURES
-- ============================================================================

-- خريطة الموردين المخصصة لكل خبير
create table if not exists public.expert_suppliers (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts (id) on delete cascade,
  supplier_type varchar(50) not null,
  name text not null,
  contact_info text,
  notes text
);

create index if not exists expert_suppliers_expert_id_idx
  on public.expert_suppliers (expert_id);
create index if not exists expert_suppliers_type_idx
  on public.expert_suppliers (supplier_type);

-- Conversion Rate Tracker
alter table public.experts
  add column if not exists total_itineraries integer not null default 0,
  add column if not exists converted_itineraries integer not null default 0;

-- حماية العدادات من القيم السالبة أو التحويلات الأعلى من الإجمالي
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'experts_conversion_counts_check'
      and conrelid = 'public.experts'::regclass
  ) then
    alter table public.experts
      add constraint experts_conversion_counts_check
      check (
        total_itineraries >= 0
        and converted_itineraries >= 0
        and converted_itineraries <= total_itineraries
      );
  end if;
end $$;

-- ============================================================================
-- 3) FINANCIAL & GAMIFICATION
-- ============================================================================

alter table public.leaders
  add column if not exists tier varchar(20) not null default 'Bronze',
  add column if not exists wallet_balance numeric(14, 2) not null default 0,
  add column if not exists pending_commission numeric(14, 2) not null default 0;

alter table public.experts
  add column if not exists tier varchar(20) not null default 'Bronze',
  add column if not exists wallet_balance numeric(14, 2) not null default 0,
  add column if not exists pending_commission numeric(14, 2) not null default 0;

-- المحفظة موحدة للشركاء؛ partner_type يحدد جدول الشريك المقصود.
-- لا يمكن إنشاء FK مباشر لأن partner_id يشير إلى أحد جدولين مختلفين.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null,
  partner_type varchar(20) not null
    check (partner_type in ('leader', 'expert')),
  amount numeric(14, 2) not null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'cleared')),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_partner_idx
  on public.wallet_transactions (partner_type, partner_id, created_at desc);
create index if not exists wallet_transactions_status_idx
  on public.wallet_transactions (status, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- الجداول الجديدة لا تُفتح للزوار؛ موظفو CRM المسجلون فقط.
-- ============================================================================

alter table public.client_reviews enable row level security;
alter table public.leader_availability enable row level security;
alter table public.trip_logs enable row level security;
alter table public.expert_suppliers enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists client_reviews_authenticated_all
  on public.client_reviews;
create policy client_reviews_authenticated_all
  on public.client_reviews for all to authenticated
  using (true) with check (true);

drop policy if exists leader_availability_authenticated_all
  on public.leader_availability;
create policy leader_availability_authenticated_all
  on public.leader_availability for all to authenticated
  using (true) with check (true);

drop policy if exists trip_logs_authenticated_all
  on public.trip_logs;
create policy trip_logs_authenticated_all
  on public.trip_logs for all to authenticated
  using (true) with check (true);

drop policy if exists expert_suppliers_authenticated_all
  on public.expert_suppliers;
create policy expert_suppliers_authenticated_all
  on public.expert_suppliers for all to authenticated
  using (true) with check (true);

drop policy if exists wallet_transactions_authenticated_all
  on public.wallet_transactions;
create policy wallet_transactions_authenticated_all
  on public.wallet_transactions for all to authenticated
  using (true) with check (true);

comment on table public.client_reviews is
  'تقييم سري يضيفه قائد الرحلة إلى ملف العميل بعد انتهاء الرحلة';
comment on table public.leader_availability is
  'تقويم تفرغ قادة الرحلات المستخدم عند التكليف';
comment on table public.trip_logs is
  'يوميات مباشرة ومرفقات يرفعها قائد الرحلة للإدارة';
comment on table public.expert_suppliers is
  'موردون مفضلون مرتبطون بخبير وجهات محدد';
comment on table public.wallet_transactions is
  'حركات محفظة القادة والخبراء: عمولات معلقة أو مصفاة';
