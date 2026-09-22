-- Wanderloom marketing_content — generator + pipeline columns
-- Run in Supabase SQL editor after deploy.

-- Relax legacy check so production_type can store generator format labels
-- (e.g. «السرد الصوتي على الأرشيف») while keeping old 'ai' / 'human' rows.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.marketing_content'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%production_type%'
  loop
    execute format('alter table public.marketing_content drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.marketing_content
  alter column production_type type text,
  alter column production_type set default 'ai';

alter table public.marketing_content
  add column if not exists content_type text not null default '';

alter table public.marketing_content
  add column if not exists destination text not null default '';

alter table public.marketing_content
  add column if not exists funnel_stage text not null default '';

alter table public.marketing_content
  add column if not exists target_audience text not null default '';

alter table public.marketing_content
  add column if not exists philosophy_pillar text not null default '';

alter table public.marketing_content
  add column if not exists stage text not null default 'فكرة';

alter table public.marketing_content
  add column if not exists metrics text not null default '-';

alter table public.marketing_content
  add column if not exists idea_code text not null default '';

create index if not exists marketing_content_status_stage_idx
  on public.marketing_content (status, stage, created_at desc);

create index if not exists marketing_content_destination_idx
  on public.marketing_content (destination, created_at desc);

create index if not exists marketing_content_funnel_stage_idx
  on public.marketing_content (funnel_stage, created_at desc);
