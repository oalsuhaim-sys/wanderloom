-- VIP tiers based on total_profit (إجمالي الأرباح) — NOT gross spend
-- Adjust thresholds below when policy changes

alter table if exists public.clients
  add column if not exists total_profit numeric(12, 2) not null default 0;

comment on column public.clients.total_profit is 'إجمالي أرباح Wanderloom من رحلات العميل (ر.س) — يُحدَّد vip_tier';
comment on column public.clients.vip_tier is 'gold | black | signature — from total_profit thresholds';

create or replace function public.resolve_vip_spending_tier(p_total_profit numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_total_profit, 0) >= 30000 then 'signature'
    when coalesce(p_total_profit, 0) >= 10000 then 'black'
    else 'gold'
  end;
$$;

create or replace function public.sync_client_vip_tier_from_profit(p_client_id integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profit numeric;
  v_tier text;
begin
  select coalesce(total_profit, 0) into v_profit from public.clients where id = p_client_id;
  if not found then return 'gold'; end if;
  v_tier := public.resolve_vip_spending_tier(v_profit);
  update public.clients set vip_tier = v_tier where id = p_client_id;
  return v_tier;
end;
$$;

grant execute on function public.resolve_vip_spending_tier(numeric) to anon, authenticated;
grant execute on function public.sync_client_vip_tier_from_profit(integer) to authenticated;
