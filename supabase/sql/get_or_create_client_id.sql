-- Find-or-create client by phone — SECURITY DEFINER + row_security off.
-- Fixes SELECT-miss + INSERT 23505 under FORCE ROW LEVEL SECURITY.
-- Run in Supabase SQL Editor (safe to re-run).

create or replace function public.get_or_create_client_id(
  p_name text,
  p_phone text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id integer;
  v_name text;
  v_phone text;
  v_digits text;
  v_canonical text;
  v_last9 text;
begin
  -- Critical when clients has FORCE ROW LEVEL SECURITY
  perform set_config('row_security', 'off', true);

  v_name := nullif(btrim(p_name), '');
  v_phone := nullif(btrim(p_phone), '');

  if v_name is null then
    raise exception 'name required';
  end if;
  if v_phone is null then
    raise exception 'phone required';
  end if;

  -- Digits only (ASCII 0-9). Caller should strip +, spaces, Arabic-Indic first.
  v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if length(v_digits) < 8 then
    raise exception 'invalid phone';
  end if;

  if left(v_digits, 2) = '00' then
    v_digits := substr(v_digits, 3);
  end if;

  -- Saudi mobile → 966XXXXXXXXX
  if left(v_digits, 2) = '05' and length(v_digits) >= 10 then
    v_canonical := '966' || substr(v_digits, 2);
  elsif left(v_digits, 1) = '5' and length(v_digits) = 9 then
    v_canonical := '966' || v_digits;
  else
    v_canonical := v_digits;
  end if;

  v_last9 := right(v_canonical, 9);

  -- Exact + last-9 match (digits-normalized)
  select c.id
    into v_id
  from public.clients c
  where c.phone_wa in (
      v_phone,
      v_digits,
      v_canonical,
      ('+' || v_canonical),
      ('0' || v_last9),
      v_last9
    )
     or right(regexp_replace(coalesce(c.phone_wa, ''), '[^0-9]', '', 'g'), 9) = v_last9
  order by c.id
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  begin
    insert into public.clients as c (name, phone_wa, client_type)
    values (v_name, v_canonical, 'عميل')
    returning c.id into v_id;

    if v_id is null then
      raise exception 'insert returned null id';
    end if;
    return v_id;
  exception
    when unique_violation then
      -- Re-select with row_security still off
      select c.id
        into v_id
      from public.clients c
      where c.phone_wa in (
          v_canonical,
          v_phone,
          v_digits,
          ('+' || v_canonical),
          ('0' || v_last9),
          v_last9
        )
         or right(regexp_replace(coalesce(c.phone_wa, ''), '[^0-9]', '', 'g'), 9) = v_last9
      order by c.id
      limit 1;

      if v_id is null then
        raise exception
          'unique_phone_wa but client row not found (phone=%)',
          v_canonical;
      end if;
      return v_id;
  end;
end;
$$;

comment on function public.get_or_create_client_id(text, text) is
  'SECURITY DEFINER find-or-create clients by phone; disables row_security for FORCE RLS';

revoke all on function public.get_or_create_client_id(text, text) from public;
grant execute on function public.get_or_create_client_id(text, text) to anon, authenticated, service_role;
