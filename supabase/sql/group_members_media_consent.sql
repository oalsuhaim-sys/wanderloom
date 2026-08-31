-- Persist media consent on the group seat row after lead conversion
alter table public.group_members
  add column if not exists media_consent boolean;

comment on column public.group_members.media_consent is
  'Client opt-in/out for promotional photography — copied from leads at conversion';
