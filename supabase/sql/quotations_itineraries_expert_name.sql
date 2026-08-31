-- Expert display name on quotations (sales) and itineraries (operations handoff)
alter table public.quotations
  add column if not exists expert_name text;

alter table public.itineraries
  add column if not exists expert_name text;

comment on column public.quotations.expert_name is
  'اسم الخبير/الموظف المسؤول عن عرض السعر — يُنقل للمسار عند التحويل';

comment on column public.itineraries.expert_name is
  'اسم الخبير/الموظف المسؤول عن تشغيل المسار (من عرض السعر أو التعيين)';

create index if not exists itineraries_expert_name_idx
  on public.itineraries (expert_name)
  where expert_name is not null and expert_name <> '';
