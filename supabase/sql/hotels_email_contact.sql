-- Hotels: email as primary contact + optional dedicated WhatsApp number
-- Run in Supabase SQL Editor.

alter table public.hotels
  add column if not exists email text;

alter table public.hotels
  add column if not exists whatsapp text;

alter table public.hotels
  add column if not exists manager_name text;

alter table public.hotels
  add column if not exists contact_number text;

comment on column public.hotels.email is 'Primary contact email shown in CRM hotels table';
comment on column public.hotels.whatsapp is 'WhatsApp digits (optional; falls back to contact_number)';
comment on column public.hotels.contact_number is 'Phone / primary WhatsApp number';
comment on column public.hotels.manager_name is 'Hotel contact person name';
