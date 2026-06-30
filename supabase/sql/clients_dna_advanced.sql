-- DNA متقدم — اهتمامات · نشاط · طلبات خاصة (Solo · Groups · Leaders)
alter table if exists public.clients
  add column if not exists dna_interests text,
  add column if not exists dna_special_requests text,
  add column if not exists dna_activity_level text;

comment on column public.clients.dna_interests is 'اهتمامات السفر — مفصولة بفاصلة (التسوق، العيادات، الفعاليات…)';
comment on column public.clients.dna_special_requests is 'طلبات خاصة للفريق';
comment on column public.clients.dna_activity_level is 'مستوى النشاط (استرخاء، مغامرة، …)';
