-- مكتبة ملفات التسويق — Supabase Storage bucket marketing_files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing_files',
  'marketing_files',
  true,
  52428800,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ]::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketing_files_public_read" on storage.objects;
create policy "marketing_files_public_read"
  on storage.objects for select
  using (bucket_id = 'marketing_files');

drop policy if exists "marketing_files_anon_insert" on storage.objects;
create policy "marketing_files_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'marketing_files');

drop policy if exists "marketing_files_anon_delete" on storage.objects;
create policy "marketing_files_anon_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'marketing_files');

drop policy if exists "marketing_files_anon_update" on storage.objects;
create policy "marketing_files_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'marketing_files');
