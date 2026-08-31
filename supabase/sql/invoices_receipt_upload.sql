-- Invoice client receipt upload (bank transfer proof)
-- Run once in Supabase SQL editor.

alter table public.invoices
  add column if not exists receipt_url text;

comment on column public.invoices.receipt_url is
  'رابط صورة الحوالة المرفوعة من صفحة الفاتورة العامة';

-- Expand status: pending → payment_review (client uploaded) → paid (admin confirmed)
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('pending', 'payment_review', 'paid', 'awaiting_confirmation'));

comment on column public.invoices.status is
  'pending | payment_review | paid (awaiting_confirmation alias supported)';

create index if not exists invoices_receipt_url_idx
  on public.invoices (receipt_url)
  where receipt_url is not null and receipt_url <> '';

-- Storage bucket for payment receipts (public read for CRM preview)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment_receipts',
  'payment_receipts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_receipts_public_read" on storage.objects;
create policy "payment_receipts_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'payment_receipts');

drop policy if exists "payment_receipts_anon_insert" on storage.objects;
create policy "payment_receipts_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'payment_receipts');

drop policy if exists "payment_receipts_anon_update" on storage.objects;
create policy "payment_receipts_anon_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'payment_receipts')
  with check (bucket_id = 'payment_receipts');

-- Fallback: allow anon upload into existing `receipts` bucket (checkout-compatible)
drop policy if exists "receipts_anon_insert_invoices" on storage.objects;
create policy "receipts_anon_insert_invoices"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_anon_update_invoices" on storage.objects;
create policy "receipts_anon_update_invoices"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_public_read" on storage.objects;
create policy "receipts_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'receipts');
