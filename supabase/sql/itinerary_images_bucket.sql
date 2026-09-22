-- صور محطات المسار — bucket عام itinerary-images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itinerary-images',
  'itinerary-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "itinerary_images_public_read" on storage.objects;
create policy "itinerary_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'itinerary-images');

drop policy if exists "itinerary_images_anon_insert" on storage.objects;
create policy "itinerary_images_anon_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'itinerary-images');

drop policy if exists "itinerary_images_auth_update" on storage.objects;
create policy "itinerary_images_auth_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'itinerary-images');

drop policy if exists "itinerary_images_auth_delete" on storage.objects;
create policy "itinerary_images_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'itinerary-images');
