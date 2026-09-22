-- قوالب عروض الأسعار — هيكل قابل لإعادة الاستخدام (مسار + فنادق + رحلات…)
create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposal_templates_created_at_idx
  on public.proposal_templates (created_at desc);

create index if not exists proposal_templates_title_idx
  on public.proposal_templates (title);

comment on table public.proposal_templates is
  'قوالب عروض أسعار CRM — days/hotels/flights/activities في content JSONB';

alter table public.proposal_templates enable row level security;

drop policy if exists "proposal_templates_select_authenticated" on public.proposal_templates;
create policy "proposal_templates_select_authenticated"
  on public.proposal_templates for select
  to authenticated
  using (true);

drop policy if exists "proposal_templates_insert_authenticated" on public.proposal_templates;
create policy "proposal_templates_insert_authenticated"
  on public.proposal_templates for insert
  to authenticated
  with check (true);

drop policy if exists "proposal_templates_update_authenticated" on public.proposal_templates;
create policy "proposal_templates_update_authenticated"
  on public.proposal_templates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "proposal_templates_delete_authenticated" on public.proposal_templates;
create policy "proposal_templates_delete_authenticated"
  on public.proposal_templates for delete
  to authenticated
  using (true);
