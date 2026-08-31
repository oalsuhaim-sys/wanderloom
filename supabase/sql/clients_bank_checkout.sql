-- صفحة السداد البنكي العامة + إيصال التحويل
-- التطبيق يستخدم Server Actions + select/update قياسي (بدون الاعتماد على RPC).
-- شغّل هذا الملف مرة واحدة لإضافة عمود receipt_url إن لم يكن موجوداً.
-- الدوال أدناه اختيارية فقط كاحتياط.

alter table if exists public.clients
  add column if not exists receipt_url text;

comment on column public.clients.receipt_url is
  'رابط إيصال التحويل البنكي — يُرفع من /checkout/[id]';

create index if not exists clients_receipt_url_idx
  on public.clients (receipt_url)
  where receipt_url is not null and receipt_url <> '';

create or replace function public.get_client_checkout_by_id(p_client_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clients%rowtype;
begin
  if p_client_id is null or length(trim(p_client_id)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.clients
  where id::text = trim(p_client_id)
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  return json_build_object(
    'id', v_row.id,
    'name', coalesce(nullif(trim(v_row.name), ''), nullif(trim(v_row.full_name), ''), 'ضيفنا الكريم'),
    'target_trip', coalesce(nullif(trim(v_row.target_trip), ''), 'رحلتك الحصرية'),
    'receipt_url', v_row.receipt_url,
    'sales_stage', v_row.sales_stage
  );
end;
$$;

create or replace function public.submit_client_bank_receipt(
  p_client_id text,
  p_receipt_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_url text;
begin
  if p_client_id is null or length(trim(p_client_id)) = 0 then
    return false;
  end if;

  v_url := nullif(trim(p_receipt_url), '');
  if v_url is null then
    return false;
  end if;

  select id into v_id
  from public.clients
  where id::text = trim(p_client_id)
  limit 1;

  if v_id is null then
    return false;
  end if;

  update public.clients
  set
    receipt_url = v_url,
    sales_stage = case
      when nullif(trim(sales_stage), '') is null then 'عميل مؤكد'
      when trim(sales_stage) like '%بانتظار الدفع%' then 'عميل مؤكد'
      else sales_stage
    end
  where id = v_id;

  return true;
end;
$$;

grant execute on function public.get_client_checkout_by_id(text) to anon, authenticated;
grant execute on function public.submit_client_bank_receipt(text, text) to anon, authenticated;
