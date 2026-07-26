/** تتبع كود الإحالة من ?ref= في الرابط (برنامج الشركاء) */

export const AFFILIATE_REF_STORAGE_KEY = 'wanderloom_affiliate_ref';

/** يزيل المسافات والشرطات للمقارنة: WL-HALA-100 ≡ WL-HALA100 ≡ wl hala 100 */
export function canonicalizeReferralCode(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** صيغ بحث محتملة لنفس الكود في قاعدة البيانات */
export function referralCodeLookupVariants(raw: string | null | undefined): string[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];

  const noSpace = trimmed.replace(/\s+/g, '');
  const noHyphen = noSpace.replace(/[-–—_]/g, '');
  const variants = new Set<string>([trimmed, noSpace, noHyphen]);

  const compact = canonicalizeReferralCode(trimmed);
  const m = /^(WL)([A-Z]+)(\d+)$/.exec(compact);
  if (m) {
    variants.add(`${m[1]}-${m[2]}-${m[3]}`);
    variants.add(`${m[1]}-${m[2]}${m[3]}`);
    variants.add(`${m[1]}${m[2]}${m[3]}`);
  }

  return [...variants].filter(Boolean);
}

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
