const PROFILE_UNLOCK_PREFIX = 'wanderloom-profile-unlock-v1';

function storageKey(clientId: string | number): string {
  return `${PROFILE_UNLOCK_PREFIX}:${String(clientId).trim()}`;
}

/** جلسة فتح الملف الشخصي — tab-scoped مثل رمز المسار */
export function hasClientProfileUnlock(clientId: string | number | null | undefined): boolean {
  if (clientId == null || String(clientId).trim() === '') return false;
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(storageKey(clientId)) === '1';
  } catch {
    return false;
  }
}

export function persistClientProfileUnlock(clientId: string | number): void {
  if (typeof window === 'undefined') return;
  const id = String(clientId).trim();
  if (!id) return;
  try {
    sessionStorage.setItem(storageKey(clientId), '1');
  } catch {
    /* quota / private mode */
  }
}

export function clearClientProfileUnlock(clientId: string | number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(clientId));
  } catch {
    /* ignore */
  }
}

export function normalizeProfilePinInput(raw: string): string {
  return raw.trim().toUpperCase();
}
