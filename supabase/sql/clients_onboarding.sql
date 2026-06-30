-- VIP Onboarding Link — token عام + حالة الإكمال
alter table if exists public.clients
  add column if not exists onboarding_token uuid unique default gen_random_uuid(),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists anniversary_date date;

comment on column public.clients.onboarding_token is 'Public token for /onboarding/[token] VIP profile form';
comment on column public.clients.onboarding_completed is 'True after client submits onboarding form';
comment on column public.clients.anniversary_date is 'Wedding / anniversary date for concierge radar';

create index if not exists clients_onboarding_token_idx on public.clients (onboarding_token);

-- قراءة آمنة بالرمز (حقول محدودة فقط)
create or replace function public.get_client_onboarding_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clients%rowtype;
  v_interests jsonb;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return null;
  end if;

  select * into v_row
  from public.clients
  where onboarding_token::text = trim(p_token)
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  select coalesce(cp.interests, '[]'::jsonb) into v_interests
  from public.client_preferences cp
  where cp.client_id = v_row.id
  limit 1;

  return json_build_object(
    'client_id', v_row.id,
    'display_name', coalesce(nullif(trim(v_row.full_name), ''), nullif(trim(v_row.name), ''), 'ضيفنا الكريم'),
    'onboarding_completed', coalesce(v_row.onboarding_completed, false),
    'birth_date', v_row.birth_date,
    'anniversary_date', v_row.anniversary_date,
    'passport_expiry', v_row.passport_expiry,
    'dna_activity_level', v_row.dna_activity_level,
    'flight_seat', v_row.flight_seat,
    'food_allergies', v_row.food_allergies,
    'favorite_drink', v_row.favorite_drink,
    'hotel_preference', v_row.hotel_preference,
    'dna_interests', v_row.dna_interests,
    'travel_dna', coalesce(v_row.travel_dna, '{}'::jsonb),
    'dietary', v_row.dietary,
    'interests', coalesce(v_interests, '[]'::jsonb)
  );
end;
$$;

-- حفظ التفضيلات من النموذج العام
create or replace function public.submit_client_onboarding(
  p_token text,
  p_birth_date date,
  p_anniversary_date date,
  p_preferred_seat text,
  p_food_allergies text,
  p_drink_coffee text,
  p_hotel_preference text,
  p_passport_expiry date,
  p_dna_activity_level text,
  p_dna_interests text,
  p_interests jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_dna jsonb;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return false;
  end if;

  select id into v_id
  from public.clients
  where onboarding_token::text = trim(p_token)
  limit 1;

  if v_id is null then
    return false;
  end if;

  v_dna := coalesce(
    (select travel_dna from public.clients where id = v_id),
    '{}'::jsonb
  );

  if p_preferred_seat is not null and length(trim(p_preferred_seat)) > 0 then
    v_dna := v_dna || jsonb_build_object('flight_seat', trim(p_preferred_seat), 'preferred_seat', trim(p_preferred_seat));
  end if;
  if p_food_allergies is not null and length(trim(p_food_allergies)) > 0 then
    v_dna := v_dna || jsonb_build_object('food_allergies', trim(p_food_allergies), 'food_preference', trim(p_food_allergies));
  end if;
  if p_drink_coffee is not null and length(trim(p_drink_coffee)) > 0 then
    v_dna := v_dna || jsonb_build_object('favorite_drink', trim(p_drink_coffee), 'drink_coffee', trim(p_drink_coffee));
  end if;
  if p_hotel_preference is not null and length(trim(p_hotel_preference)) > 0 then
    v_dna := v_dna || jsonb_build_object('hotel_preference', trim(p_hotel_preference), 'hotel_style', trim(p_hotel_preference));
  end if;

  update public.clients
  set
    birth_date = coalesce(p_birth_date, birth_date),
    anniversary_date = coalesce(p_anniversary_date, anniversary_date),
    passport_expiry = coalesce(p_passport_expiry, passport_expiry),
    flight_seat = coalesce(nullif(trim(p_preferred_seat), ''), flight_seat),
    food_allergies = coalesce(nullif(trim(p_food_allergies), ''), food_allergies),
    favorite_drink = coalesce(nullif(trim(p_drink_coffee), ''), favorite_drink),
    hotel_preference = coalesce(nullif(trim(p_hotel_preference), ''), hotel_preference),
    dna_interests = coalesce(nullif(trim(p_dna_interests), ''), dna_interests),
    dna_activity_level = coalesce(nullif(trim(p_dna_activity_level), ''), dna_activity_level),
    flight_preferences = coalesce(nullif(trim(p_preferred_seat), ''), flight_preferences),
    hotel_preferences = coalesce(nullif(trim(p_hotel_preference), ''), hotel_preferences),
    dietary = coalesce(nullif(trim(p_food_allergies), ''), dietary),
    travel_dna = v_dna,
    onboarding_completed = true
  where id = v_id;

  if exists (select 1 from public.client_preferences where client_id = v_id) then
    update public.client_preferences
    set interests = coalesce(p_interests, '[]'::jsonb)
    where client_id = v_id;
  else
    insert into public.client_preferences (client_id, interests)
    values (v_id, coalesce(p_interests, '[]'::jsonb));
  end if;

  return true;
end;
$$;

drop function if exists public.submit_client_onboarding(text, date, date, text, text, text, jsonb);

grant execute on function public.get_client_onboarding_by_token(text) to anon, authenticated;
grant execute on function public.submit_client_onboarding(text, date, date, text, text, text, text, date, text, text, jsonb) to anon, authenticated;
