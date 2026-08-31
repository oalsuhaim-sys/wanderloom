import { randomBytes } from 'crypto';

export const LEADER_CALENDAR_PATH = '/leader-calendar';

export function generateLeaderCalendarToken(): string {
  return randomBytes(24).toString('base64url');
}

export function buildLeaderCalendarPath(token: string): string {
  const t = String(token ?? '').trim();
  return `${LEADER_CALENDAR_PATH}?token=${encodeURIComponent(t)}`;
}

export function buildLeaderCalendarAbsoluteUrl(
  token: string,
  origin?: string | null,
): string {
  const path = buildLeaderCalendarPath(token);
  const base = String(origin ?? '').trim().replace(/\/$/, '');
  if (base) return `${base}${path}`;

  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    '';
  if (env) return `${env.replace(/\/$/, '')}${path}`;
  return path;
}

export function isValidCalendarToken(raw: unknown): boolean {
  const t = String(raw ?? '').trim();
  return t.length >= 16 && t.length <= 128 && /^[A-Za-z0-9_-]+$/.test(t);
}
