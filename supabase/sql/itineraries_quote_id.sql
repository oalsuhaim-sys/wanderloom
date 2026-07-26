-- ربط المسار الخاص بعرض السعر (nullable — المسارات الجماعية بلا quote_id)
-- trip_type موجود مسبقاً: Individual = رحلة خاصة · Group = رحلة جماعية

alter table public.itineraries
  add column if not exists quote_id text;

comment on column public.itineraries.quote_id is
  'معرّف quotations.id للمسار الخاص (رحلة خاصة). null للمسارات الجماعية / القوالب.';

create index if not exists itineraries_quote_id_idx
  on public.itineraries (quote_id)
  where quote_id is not null;

-- تأكيد أن trip_type يدعم Individual | Group
alter table public.itineraries
  add column if not exists trip_type text not null default 'Individual';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'itineraries' and c.conname = 'itineraries_trip_type_check'
  ) then
    alter table public.itineraries
      add constraint itineraries_trip_type_check
      check (trip_type in ('Individual', 'Group'));
  end if;
end $$;
