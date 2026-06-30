-- استوديو الإنتاج: الذكاء الاصطناعي + الإنتاج البشري
create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  production_type text not null check (production_type in ('ai', 'human')),
  content_category text not null default 'أخرى',
  media_type text not null default 'فيديو',
  prompt text not null default '',
  script text not null default '',
  caption text not null default '',
  video_url text,
  status text not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_content
  add column if not exists content_category text not null default 'أخرى';

alter table public.marketing_content
  add column if not exists caption text not null default '';

alter table public.marketing_content
  add column if not exists media_type text not null default 'فيديو';

create index if not exists marketing_content_production_type_idx
  on public.marketing_content (production_type, sort_order, created_at);

create index if not exists marketing_content_category_idx
  on public.marketing_content (content_category, sort_order, created_at);

create index if not exists marketing_content_media_type_idx
  on public.marketing_content (media_type, content_category, sort_order, created_at);

alter table public.marketing_content enable row level security;

drop policy if exists "marketing_content_crm_all" on public.marketing_content;
create policy "marketing_content_crm_all"
  on public.marketing_content for all
  to anon, authenticated
  using (true) with check (true);

-- صفوف افتراضية (واحد لكل نوع)
insert into public.marketing_content (title, production_type, prompt, script, status, sort_order)
select 'الذكاء الاصطناعي', 'ai', '', '', 'جاهز للتوليد', 0
where not exists (select 1 from public.marketing_content where production_type = 'ai');

insert into public.marketing_content (title, production_type, prompt, script, status, sort_order)
select 'الإنتاج البشري', 'human', '', '', 'بانتظار التصوير', 1
where not exists (select 1 from public.marketing_content where production_type = 'human');
