-- Session clock time, stored separately from the date column.
alter table public.sessions
  add column if not exists time text;

comment on column public.sessions.time is 'وقت الجلسة بصيغة HH:mm';
