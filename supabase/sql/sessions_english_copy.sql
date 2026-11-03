-- Optional English copy for sessions, shown on the English site. Additive and non-destructive.
alter table public.sessions add column if not exists title_en text;
alter table public.sessions add column if not exists description_en text;

comment on column public.sessions.title_en is 'عنوان الجلسة بالإنجليزي (للموقع الإنجليزي)';
comment on column public.sessions.description_en is 'وصف الجلسة بالإنجليزي (للموقع الإنجليزي)';
