/**
 * Resolve Buffer / Metricool credentials from system_settings DB + env fallbacks.
 */

export type SocialSchedulerProvider = 'buffer' | 'metricool' | 'none';

export type SocialSchedulerCredentials = {
  provider: SocialSchedulerProvider;
  apiKey: string;
  /** Buffer profile IDs (comma) or Metricool blogId */
  extra: string;
  source: 'database' | 'env' | 'none';
};

export type SocialSchedulerPublicStatus = {
  configured: boolean;
  provider: SocialSchedulerProvider;
  message: string;
  /** Masked key hint e.g. ••••ab12 — never full secret */
  keyHint: string | null;
  extraHint: string | null;
  source: 'database' | 'env' | 'none';
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeSocialProvider(raw: unknown): SocialSchedulerProvider {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'buffer') return 'buffer';
  if (v === 'metricool') return 'metricool';
  return 'none';
}

export function maskSecret(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

export function socialCredentialsFromEnv(): SocialSchedulerCredentials {
  const explicit = normalizeSocialProvider(process.env.SOCIAL_SCHEDULER_PROVIDER);
  const bufferToken = (process.env.BUFFER_ACCESS_TOKEN ?? '').trim();
  const metricoolKey = (
    process.env.METRICOOL_API_KEY ??
    process.env.METRICOOL_TOKEN ??
    ''
  ).trim();

  let provider: SocialSchedulerProvider = explicit;
  if (provider === 'none') {
    if (bufferToken) provider = 'buffer';
    else if (metricoolKey) provider = 'metricool';
  }

  if (provider === 'buffer' && bufferToken) {
    return {
      provider: 'buffer',
      apiKey: bufferToken,
      extra: String(process.env.BUFFER_PROFILE_IDS ?? '').trim(),
      source: 'env',
    };
  }
  if (provider === 'metricool' && metricoolKey) {
    return {
      provider: 'metricool',
      apiKey: metricoolKey,
      extra: String(
        process.env.METRICOOL_BLOG_ID ?? process.env.METRICOOL_USER_ID ?? '',
      ).trim(),
      source: 'env',
    };
  }
  return { provider: 'none', apiKey: '', extra: '', source: 'none' };
}

export function socialCredentialsFromDbRow(
  row: Record<string, unknown> | null | undefined,
): SocialSchedulerCredentials | null {
  if (!row) return null;
  const provider = normalizeSocialProvider(row.social_provider);
  const apiKey = String(row.social_api_key ?? '').trim();
  const extra = String(row.social_extra ?? '').trim();
  if (provider === 'none' || !apiKey) return null;
  return { provider, apiKey, extra, source: 'database' };
}

/** Prefer DB credentials; fall back to environment. */
export function mergeSocialCredentials(
  fromDb: SocialSchedulerCredentials | null,
  fromEnv: SocialSchedulerCredentials = socialCredentialsFromEnv(),
): SocialSchedulerCredentials {
  if (fromDb && fromDb.provider !== 'none' && fromDb.apiKey) return fromDb;
  return fromEnv;
}

export function toPublicSocialStatus(
  creds: SocialSchedulerCredentials,
): SocialSchedulerPublicStatus {
  if (creds.provider === 'none' || !creds.apiKey) {
    return {
      configured: false,
      provider: 'none',
      message: 'لم يُضبط Buffer أو Metricool بعد.',
      keyHint: null,
      extraHint: null,
      source: 'none',
    };
  }
  const label = creds.provider === 'buffer' ? 'Buffer' : 'Metricool';
  return {
    configured: true,
    provider: creds.provider,
    message: `✅ التوصيل مفعل بـ ${label}`,
    keyHint: maskSecret(creds.apiKey),
    extraHint: creds.extra ? maskSecret(creds.extra) : null,
    source: creds.source,
  };
}

export function mapDbSocialRow(data: unknown): SocialSchedulerCredentials | null {
  return socialCredentialsFromDbRow(asRecord(data));
}
