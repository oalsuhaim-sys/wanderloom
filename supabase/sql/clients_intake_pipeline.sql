-- أتمتة استقبال العملاء من الموقع — ربط leads ↔ clients + حالة DNA + تقويم الاختيار
-- نفّذ في SQL Editor في Supabase بعد clients_onboarding.sql و clients_sales_stage.sql
-- رابط التقويم الافتراضي: https://cal.com/omar-alsuhaim-jv2uy2/30min (في src/lib/client-intake-pipeline.ts)

alter table if exists public.leads
  add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists leads_client_id_idx on public.leads (client_id)
  where client_id is not null;

comment on column public.leads.client_id is 'العميل المُنشأ تلقائياً عند استلام الطلب من الموقع';

alter table if exists public.clients
  add column if not exists intake_automated_at timestamptz,
  add column if not exists dna_link_sent_at timestamptz;

comment on column public.clients.intake_automated_at is 'وقت تشغيل أتمتة استقبال الطلب من الموقع';
comment on column public.clients.dna_link_sent_at is 'آخر مرة أُرسل فيها رابط DNA + تقويم الاجتماع للعميل';

create index if not exists clients_intake_automated_at_idx
  on public.clients (intake_automated_at desc)
  where intake_automated_at is not null;
