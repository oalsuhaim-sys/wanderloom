-- Bucket تخزين صور «صندوق الذكريات» (memories) — يُستخدم من صفحة الرابط السحري
-- نفّذ في SQL Editor بعد مراجعة سياسات الأمان.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "memories_public_read" on storage.objects;
create policy "memories_public_read"
  on storage.objects
  for select
  using (bucket_id = 'memories');

drop policy if exists "memories_anon_insert" on storage.objects;
create policy "memories_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'memories');

comment on column public.memory_vault.image_urls is 'روابط عامة بعد الرفع إلى storage bucket memories';
