/**
 * Zero-Wait onboarding — shared (client + server safe) DNA stage labels.
 *
 * The lead's pipeline status stays the SSOT (`leads.status`); these labels are a
 * read-only lens on `clients.onboarding_completed` so the Requests Board and the
 * Kanban can show where the client is in the DNA step without new DB columns.
 */

export const DNA_AWAITING_LABEL = 'بانتظار إكمال الـ DNA';
export const DNA_COMPLETE_LABEL = 'مكتمل الـ DNA - جاهز للتسعير/توليد المسار';

export type InstantDnaStage = 'awaiting' | 'complete' | 'none';

export function instantDnaStage(intake: { onboardingCompleted?: boolean | null } | null | undefined): InstantDnaStage {
  if (!intake) return 'none';
  return intake.onboardingCompleted ? 'complete' : 'awaiting';
}

export function instantDnaStageLabel(stage: InstantDnaStage): string {
  if (stage === 'complete') return DNA_COMPLETE_LABEL;
  if (stage === 'awaiting') return DNA_AWAITING_LABEL;
  return '';
}

/** Path-only DNA link (`/welcome/{clientId}`) — works on any host (preview, prod, localhost). */
export function dnaPathFromUrl(dnaUrl: string | null | undefined): string | null {
  const raw = String(dnaUrl ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw, 'https://placeholder.local');
    return `${u.pathname}${u.search}`;
  } catch {
    return raw.startsWith('/') ? raw : null;
  }
}

/** Absolute link for copy / WhatsApp from the browser's own origin. */
export function absoluteDnaUrl(dnaPath: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return base ? `${base}${dnaPath}` : dnaPath;
}

/* ── «أكملها لاحقاً» — a gentle reminder kept on the visitor's own device ── */

const PENDING_DNA_KEY = 'wl:pending-dna:v1';
const PENDING_DNA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type PendingDna = { path: string; name: string; savedAt: number };

export function rememberPendingDna(path: string, name: string): void {
  try {
    window.localStorage.setItem(PENDING_DNA_KEY, JSON.stringify({ path, name, savedAt: Date.now() } satisfies PendingDna));
  } catch {
    /* private mode — nothing to remember */
  }
}

export function readPendingDna(): PendingDna | null {
  try {
    const raw = window.localStorage.getItem(PENDING_DNA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDna;
    if (!parsed?.path || !String(parsed.path).startsWith('/welcome/')) return null;
    if (Date.now() - Number(parsed.savedAt ?? 0) > PENDING_DNA_MAX_AGE_MS) {
      window.localStorage.removeItem(PENDING_DNA_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingDna(): void {
  try {
    window.localStorage.removeItem(PENDING_DNA_KEY);
  } catch {
    /* ignore */
  }
}
