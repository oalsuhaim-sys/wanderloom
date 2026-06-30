-- VIP Welcome Onboarding (/welcome/:token)
-- preferences · family_members · passport_docs

alter table if exists public.clients
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists family_members jsonb not null default '[]'::jsonb,
  add column if not exists passport_docs jsonb not null default '[]'::jsonb;

comment on column public.clients.preferences is 'VIP welcome onboarding: travel style + wardrobe JSON';
comment on column public.clients.family_members is 'VIP companions [{name, age, relation}]';
comment on column public.clients.passport_docs is 'VIP passport/ID uploads [{name, url, uploaded_at}]';

-- Allow passport images in documents bucket (in addition to PDF)
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]::text[]
where id = 'documents';

create or replace function public.get_client_welcome_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clients%rowtype;
begin
  if p_token is null or trim(p_token) = '' then
    return null;
  end if;

  select * into v_row
    from public.clients
   where onboarding_token::text = trim(p_token)
   limit 1;

  if v_row.id is null then
    return null;
  end if;

  return json_build_object(
    'client_id', v_row.id,
    'display_name', coalesce(nullif(trim(v_row.full_name), ''), nullif(trim(v_row.name), ''), 'ضيفنا الكريم'),
    'onboarding_completed', coalesce(v_row.onboarding_completed, false),
    'preferences', coalesce(v_row.preferences, '{}'::jsonb),
    'family_members', coalesce(v_row.family_members, '[]'::jsonb),
    'passport_docs', coalesce(v_row.passport_docs, '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_client_welcome_by_token(
  p_token text,
  p_preferences jsonb default '{}'::jsonb,
  p_family_members jsonb default '[]'::jsonb,
  p_passport_docs jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or trim(p_token) = '' then
    return false;
  end if;

  update public.clients
  set
    preferences = coalesce(p_preferences, '{}'::jsonb),
    family_members = coalesce(p_family_members, '[]'::jsonb),
    onboarding_completed = true
  where onboarding_token::text = trim(p_token);

  return found;
end;
$$;

create or replace function public.get_client_welcome_by_id(p_client_id integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clients%rowtype;
begin
  if p_client_id is null or p_client_id <= 0 then
    return null;
  end if;

  select * into v_row from public.clients where id = p_client_id limit 1;
  if v_row.id is null then
    return null;
  end if;

  return json_build_object(
    'client_id', v_row.id,
    'display_name', coalesce(nullif(trim(v_row.full_name), ''), nullif(trim(v_row.name), ''), 'ضيفنا الكريم'),
    'onboarding_completed', coalesce(v_row.onboarding_completed, false),
    'preferences', coalesce(v_row.preferences, '{}'::jsonb),
    'family_members', coalesce(v_row.family_members, '[]'::jsonb),
    'passport_docs', coalesce(v_row.passport_docs, '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_client_welcome_onboarding(
  p_client_id integer,
  p_preferences jsonb default '{}'::jsonb,
  p_family_members jsonb default '[]'::jsonb,
  p_passport_docs jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_id is null or p_client_id <= 0 then
    return false;
  end if;

  update public.clients
  set
    preferences = coalesce(p_preferences, '{}'::jsonb),
    family_members = coalesce(p_family_members, '[]'::jsonb),
    onboarding_completed = true
  where id = p_client_id;

  return found;
end;
$$;

grant execute on function public.get_client_welcome_by_token(text) to anon, authenticated;
grant execute on function public.submit_client_welcome_by_token(text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.get_client_welcome_by_id(integer) to anon, authenticated;
grant execute on function public.submit_client_welcome_onboarding(integer, jsonb, jsonb, jsonb) to anon, authenticated;
