-- Leader flag for unified clients table (الليدرز tab)
alter table public.clients
  add column if not exists is_leader boolean not null default false;

-- Optional: followers_count alias column (if not already present)
alter table public.clients
  add column if not exists followers_count integer;

-- Backfill followers_count from legacy influencer_followers where empty
update public.clients
set followers_count = influencer_followers
where followers_count is null
  and influencer_followers is not null;

create index if not exists clients_is_leader_idx on public.clients (is_leader) where is_leader = true;
