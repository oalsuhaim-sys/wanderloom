-- وسوم مواسم/أنواع للربط مع اهتمامات العملاء (مصفوفة نصوص عربية/إنجليزية)
alter table public.events
  add column if not exists season_tags text[] default '{}';

comment on column public.events.season_tags is 'وسوم للمطابقة مع اهتمامات العميل، مثل: شتاء، تسوق، كريسماس';
