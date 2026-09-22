-- Social scheduler credentials for Marketing Hub (Buffer / Metricool)
alter table public.system_settings
  add column if not exists social_provider text,
  add column if not exists social_api_key text,
  add column if not exists social_extra text,
  add column if not exists social_updated_at timestamptz;

comment on column public.system_settings.social_provider is
  'buffer | metricool — preferred social scheduler';
comment on column public.system_settings.social_api_key is
  'BUFFER_ACCESS_TOKEN or METRICOOL_API_KEY (stored server-side only)';
comment on column public.system_settings.social_extra is
  'BUFFER_PROFILE_IDS (comma) or METRICOOL_BLOG_ID';
