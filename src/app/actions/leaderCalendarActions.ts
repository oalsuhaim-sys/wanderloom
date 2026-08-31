'use server';

import { headers } from 'next/headers';

import { ensureLeaderCalendarLink } from '@/lib/leader-calendar-portal';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type EnsureLeaderCalendarLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** CRM-only helper — call from authenticated partners directory UI */
export async function ensureLeaderCalendarLinkAction(
  leaderId: string,
): Promise<EnsureLeaderCalendarLinkResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const id = String(leaderId ?? '').trim();
  if (!id) return { ok: false, error: 'معرّف القائد غير صالح.' };

  let origin: string | null = null;
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'https';
    if (host) origin = `${proto}://${host}`;
  } catch {
    origin = null;
  }

  const result = await ensureLeaderCalendarLink(id, origin);
  if (!result.ok) return result;
  return { ok: true, url: result.url };
}
