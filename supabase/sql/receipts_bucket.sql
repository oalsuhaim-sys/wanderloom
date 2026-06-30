-- bucket إيصالات التحويل البنكي — صفحة /checkout/[id]
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_public_read" on storage.objects;
create policy "receipts_public_read"
  on storage.objects
  for select
  using (bucket_id = 'receipts');

drop policy if exists "receipts_anon_insert" on storage.objects;
create policy "receipts_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_auth_insert" on storage.objects;
create policy "receipts_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'receipts');
