-- مرفقات تذاكر الفعاليات (صور باركود / QR · PDF) — مسار بناء المسار
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "attachments_public_read" on storage.objects;
create policy "attachments_public_read"
  on storage.objects
  for select
  using (bucket_id = 'attachments');

drop policy if exists "attachments_anon_insert" on storage.objects;
create policy "attachments_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'attachments');

drop policy if exists "attachments_auth_insert" on storage.objects;
create policy "attachments_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'attachments');
