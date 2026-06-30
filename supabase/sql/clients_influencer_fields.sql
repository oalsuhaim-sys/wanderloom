-- حقول المؤثرين الموحّدة في جدول clients (بعد دمج influencers)
alter table public.clients
  add column if not exists is_influencer boolean not null default false,
  add column if not exists influencer_followers bigint,
  add column if not exists influencer_commission numeric(5, 2),
  add column if not exists platforms text,
  add column if not exists content_focus text,
  add column if not exists profile_url text;

comment on column public.clients.is_influencer is 'هل جهة الاتصال مؤثر؟';
comment on column public.clients.influencer_followers is 'عدد متابعي المؤثر';
comment on column public.clients.influencer_commission is 'نسبة عمولة المؤثر %';

-- ترحيل من client_type أو followers_count legacy
update public.clients
set is_influencer = true
where client_type = 'مؤثر' and is_influencer = false;

update public.clients
set influencer_followers = followers_count
where influencer_followers is null
  and followers_count is not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'content_niche'
  ) then
    update public.clients
    set content_focus = coalesce(nullif(trim(content_focus), ''), nullif(trim(content_niche), ''))
    where is_influencer = true;
  end if;
end $$;
