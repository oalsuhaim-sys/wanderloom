-- محفظة مستندات المسار (تذاكر، قسائم PDF)
alter table public.itineraries
  add column if not exists documents jsonb not null default '[]'::jsonb;

comment on column public.itineraries.documents is
  'مصفوفة JSON: [{ id, name, url, uploaded_at, mime_type }] — تذاكر وقسائم PDF';
