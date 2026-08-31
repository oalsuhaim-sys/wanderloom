-- Enable Supabase Realtime for CRM live toasts + Radar auto-refresh.
-- Run once in Supabase SQL Editor (Dashboard → Database → Replication also works).

-- Prefer full row images on UPDATE so DNA / quote / payment transitions are detectable
alter table if exists public.leads replica identity full;
alter table if exists public.clients replica identity full;
alter table if exists public.quotations replica identity full;
alter table if exists public.invoices replica identity full;
alter table if exists public.group_members replica identity full;

-- Add tables to the supabase_realtime publication (ignore if already members)
do $$
begin
  begin
    alter publication supabase_realtime add table public.leads;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.clients;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.quotations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.invoices;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.group_members;
  exception when duplicate_object then null;
  end;
end $$;
