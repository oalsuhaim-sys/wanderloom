-- Bucket تخزين مستندات المسار (PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itinerary-documents',
  'itinerary-documents',
  true,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "itinerary_documents_public_read" on storage.objects;
create policy "itinerary_documents_public_read"
  on storage.objects
  for select
  using (bucket_id = 'itinerary-documents');

drop policy if exists "itinerary_documents_anon_insert" on storage.objects;
create policy "itinerary_documents_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'itinerary-documents');
