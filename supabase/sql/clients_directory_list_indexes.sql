-- Fast directory: ORDER BY created_at DESC LIMIT n
-- PK already covers `id`; add supporting indexes for list + search.

create index if not exists clients_created_at_desc_idx
  on public.clients (created_at desc nulls last);

create index if not exists clients_name_idx
  on public.clients (name);
