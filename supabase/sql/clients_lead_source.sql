-- مصدر العميل (Lead Source) لتتبع ROI الحملات التسويقية
-- نفّذ في SQL Editor في Supabase.

alter table if exists public.clients
  add column if not exists lead_source text;

comment on column public.clients.lead_source is
  'Marketing attribution: instagram_reel, tiktok, snapchat, referral, google, other';

create index if not exists clients_lead_source_idx on public.clients (lead_source)
  where lead_source is not null;

alter table if exists public.quotations
  add column if not exists lead_source text;

comment on column public.quotations.lead_source is
  'Lead source captured when creating/updating a quotation';

create index if not exists quotations_lead_source_idx on public.quotations (lead_source)
  where lead_source is not null;
