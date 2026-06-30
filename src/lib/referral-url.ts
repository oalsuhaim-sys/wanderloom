/** تتبع كود الإحالة من ?ref= في الرابط (برنامج الشركاء) */

export const AFFILIATE_REF_STORAGE_KEY = 'wanderloom_affiliate_ref';

export function normalizeAffiliateRef(raw: string | null | undefined): string | null {
  const code = String(raw ?? '').trim();
  if (!code) return null;
  if (code.length > 64) return code.slice(0, 64);
  return code;
}

export function persistAffiliateRef(code: string): void {
  const normalized = normalizeAffiliateRef(code);
  if (!normalized || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AFFILIATE_REF_STORAGE_KEY, normalized);
    localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedAffiliateRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeAffiliateRef(
      sessionStorage.getItem(AFFILIATE_REF_STORAGE_KEY) ||
        localStorage.getItem(AFFILIATE_REF_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function clearPersistedAffiliateRef(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AFFILIATE_REF_STORAGE_KEY);
    localStorage.removeItem(AFFILIATE_REF_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** رابط الإحالة العام: https://example.com/join?ref=CODE */
export function buildAffiliateReferralUrl(
  code: string | null | undefined,
  origin?: string,
): string {
  const normalized = normalizeAffiliateRef(code);
  if (!normalized) return '';
  const base = (
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '');
  if (!base) return '';
  return `${base}/join?ref=${encodeURIComponent(normalized)}`;
}
