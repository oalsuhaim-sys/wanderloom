-- Drop redundant clients.referral_code — SSOT is clients.ref_code
-- Run in Supabase SQL Editor after deploying ref_code-only app code.

-- Optional: copy any leftover values before drop
update public.clients
set ref_code = nullif(trim(referral_code), '')
where (ref_code is null or trim(ref_code) = '')
  and referral_code is not null
  and trim(referral_code) <> '';

alter table if exists public.clients
  drop column if exists referral_code;
