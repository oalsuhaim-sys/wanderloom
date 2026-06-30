-- وسوم CRM لكل عميل (مصفوفة نصوص) — نفّذ في SQL Editor في Supabase.
alter table public.clients
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.clients.tags is 'وسوم سريعة (DNA سياحي): VIP، عائلة، تفضيلات…';

create index if not exists clients_tags_gin_idx on public.clients using gin (tags);
