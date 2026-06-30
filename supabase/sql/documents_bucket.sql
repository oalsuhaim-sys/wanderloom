-- Bucket مستندات المسار (PDF) — الاسم المستخدم في الواجهة: documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_public_read" on storage.objects;
create policy "documents_public_read"
  on storage.objects
  for select
  using (bucket_id = 'documents');

drop policy if exists "documents_anon_insert" on storage.objects;
create policy "documents_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'documents');
