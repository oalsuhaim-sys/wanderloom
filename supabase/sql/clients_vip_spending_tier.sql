-- Automated VIP spending tiers (Gold / Black / Signature)

alter table if exists public.clients
  add column if not exists total_spent numeric(12, 2) not null default 0,
  add column if not exists vip_tier text not null default 'gold';

comment on column public.clients.total_spent is 'إجمالي مصروفات العميل من خصومات محفظة العهدة (ر.س)';
comment on column public.clients.vip_tier is 'gold | black | signature — يُحدَّث تلقائياً من total_spent';

create or replace function public.resolve_vip_spending_tier(p_total_spent numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_total_spent, 0) >= 150000 then 'signature'
    when coalesce(p_total_spent, 0) >= 50000 then 'black'
    else 'gold'
  end;
$$;

create or replace function public.add_client_wallet_transaction(
  p_client_id integer,
  p_amount numeric,
  p_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_total_spent numeric;
  v_tier text;
  v_id bigint;
begin
  if p_client_id is null then
    raise exception 'client_id_required';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'amount_required';
  end if;

  select coalesce(wallet_balance, 0), coalesce(total_spent, 0)
    into v_balance, v_total_spent
    from public.clients
   where id = p_client_id
   for update;

  if not found then
    raise exception 'client_not_found';
  end if;

  insert into public.wallet_transactions (client_id, amount, description)
  values (p_client_id, p_amount, coalesce(trim(p_description), ''))
  returning id into v_id;

  v_balance := v_balance + p_amount;

  if p_amount < 0 then
    v_total_spent := v_total_spent + abs(p_amount);
  end if;

  v_tier := public.resolve_vip_spending_tier(v_total_spent);

  update public.clients
     set wallet_balance = v_balance,
         total_spent = v_total_spent,
         vip_tier = v_tier
   where id = p_client_id;

  return jsonb_build_object(
    'transaction_id', v_id,
    'new_balance', v_balance,
    'new_total_spent', v_total_spent,
    'vip_tier', v_tier
  );
end;
$$;

grant execute on function public.resolve_vip_spending_tier(numeric) to anon, authenticated;
grant execute on function public.add_client_wallet_transaction(integer, numeric, text) to anon, authenticated;
