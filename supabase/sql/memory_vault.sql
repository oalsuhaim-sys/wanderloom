-- صندوق الذكريات (Memory Vault) — صور وتقييم بعد الرحلة، مرتبط بالرابط السحري

create table if not exists public.memory_vault (
  id uuid primary key default gen_random_uuid(),
  magic_link_id text not null,
  itinerary_id text,
  image_urls text[] not null default '{}',
  comment text,
  rating smallint not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now()
);

create index if not exists memory_vault_magic_link_id_idx on public.memory_vault (magic_link_id);
create index if not exists memory_vault_created_at_idx on public.memory_vault (created_at desc);

comment on table public.memory_vault is 'ذكريات العميل بعد الرحلة؛ magic_link_id يطابق magic_link_id أو passcode أو id نصي في itineraries';
comment on column public.memory_vault.image_urls is 'روابط عامة بعد الرفع إلى storage bucket memory-vault';

alter table public.memory_vault enable row level security;

drop policy if exists "memory_vault_anon_insert" on public.memory_vault;
create policy "memory_vault_anon_insert"
  on public.memory_vault
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.itineraries i
      where
        (nullif(trim(i.magic_link_id), '') is not null and nullif(trim(i.magic_link_id), '') = memory_vault.magic_link_id)
        or (nullif(trim(i.passcode), '') is not null and nullif(trim(i.passcode), '') = memory_vault.magic_link_id)
        or (i.id::text = memory_vault.magic_link_id)
    )
  );

drop policy if exists "memory_vault_authenticated_select" on public.memory_vault;
create policy "memory_vault_authenticated_select"
  on public.memory_vault
  for select
  to authenticated
  using (true);

-- تخزين الصور (نفّذ بعد إنشاء الجدول؛ أنشئ الـ bucket من لوحة Supabase إذا فشل الإدراج)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-vault',
  'memory-vault',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "memory_vault_storage_public_read" on storage.objects;
create policy "memory_vault_storage_public_read"
  on storage.objects
  for select
  using (bucket_id = 'memory-vault');

drop policy if exists "memory_vault_storage_anon_insert" on storage.objects;
create policy "memory_vault_storage_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'memory-vault');
