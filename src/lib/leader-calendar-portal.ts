import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildLeaderCalendarAbsoluteUrl,
  generateLeaderCalendarToken,
  isValidCalendarToken,
} from '@/lib/leader-calendar-link';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type LeaderCalendarProfile = {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  initials: string;
};

export type LeaderCalendarPayload = {
  profile: LeaderCalendarProfile;
  unavailableDates: string[];
  bookedDates: string[];
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return (parts[0] ?? 'WL').slice(0, 2).toUpperCase();
}

function expandDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return out;
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function collectDatesByStatus(
  rows: Array<{ start_date?: unknown; end_date?: unknown; status?: unknown }>,
  status: string,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (String(row.status ?? '') !== status) continue;
    const start = String(row.start_date ?? '').slice(0, 10);
    const end = String(row.end_date ?? start).slice(0, 10);
    for (const d of expandDateRange(start, end)) set.add(d);
  }
  return [...set].sort();
}

export async function resolveLeaderByCalendarToken(
  tokenRaw: string,
  admin?: SupabaseClient,
): Promise<
  | { ok: true; leader: Record<string, unknown> }
  | { ok: false; error: string }
> {
  if (!isValidCalendarToken(tokenRaw)) {
    return { ok: false, error: 'رابط التفرغ غير صالح.' };
  }
  const token = String(tokenRaw).trim();
  const client = admin ?? createSupabaseAdminClient();

  const { data, error } = await client
    .from('leaders')
    .select('id, name, phone, country_code, city, status, calendar_token')
    .eq('calendar_token', token)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'رابط التفرغ غير موجود أو منتهي.' };

  const status = String((data as { status?: unknown }).status ?? '').toLowerCase();
  if (status && status !== 'active' && status !== 'approved') {
    return { ok: false, error: 'حساب القائد غير نشط حالياً.' };
  }

  return { ok: true, leader: data as Record<string, unknown> };
}

export async function fetchLeaderCalendarPayload(
  token: string,
): Promise<{ ok: true; data: LeaderCalendarPayload } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const resolved = await resolveLeaderByCalendarToken(token, admin);
  if (!resolved.ok) return resolved;

  const leader = resolved.leader;
  const leaderId = String(leader.id ?? '');
  const name = String(leader.name ?? '').trim() || 'قائد رحلات';

  const { data: rows, error } = await admin
    .from('leader_availability')
    .select('start_date, end_date, status')
    .eq('leader_id', leaderId);

  if (error) return { ok: false, error: error.message };

  const list = (rows ?? []) as Array<{
    start_date?: unknown;
    end_date?: unknown;
    status?: unknown;
  }>;

  return {
    ok: true,
    data: {
      profile: {
        id: leaderId,
        name,
        countryCode:
          leader.country_code != null ? String(leader.country_code).trim() || null : null,
        city: leader.city != null ? String(leader.city).trim() || null : null,
        initials: initialsFromName(name),
      },
      unavailableDates: collectDatesByStatus(list, 'unavailable'),
      bookedDates: collectDatesByStatus(list, 'booked'),
    },
  };
}

export async function saveLeaderUnavailableDatesByToken(
  token: string,
  unavailableDates: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const resolved = await resolveLeaderByCalendarToken(token, admin);
  if (!resolved.ok) return resolved;

  const leaderId = String(resolved.leader.id ?? '');
  const clean = [
    ...new Set(
      unavailableDates
        .map((d) => String(d ?? '').trim().slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();

  // Keep booked rows; replace unmanaged unavailable singles/ranges
  const { error: delError } = await admin
    .from('leader_availability')
    .delete()
    .eq('leader_id', leaderId)
    .eq('status', 'unavailable');

  if (delError) return { ok: false, error: delError.message };

  if (clean.length === 0) return { ok: true };

  const payload = clean.map((date) => ({
    leader_id: leaderId,
    start_date: date,
    end_date: date,
    status: 'unavailable' as const,
  }));

  const { error: insertError } = await admin
    .from('leader_availability')
    .insert(payload);

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}

/** Ensure leader has calendar_token; return absolute public URL */
export async function ensureLeaderCalendarLink(
  leaderIdRaw: string | number,
  origin?: string | null,
): Promise<{ ok: true; url: string; token: string } | { ok: false; error: string }> {
  const leaderId = String(leaderIdRaw ?? '').trim();
  if (!leaderId) return { ok: false, error: 'معرّف القائد غير صالح.' };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('leaders')
    .select('id, calendar_token')
    .eq('id', leaderId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'القائد غير موجود.' };

  let token = String((data as { calendar_token?: unknown }).calendar_token ?? '').trim();
  if (!isValidCalendarToken(token)) {
    token = generateLeaderCalendarToken();
    const { error: updError } = await admin
      .from('leaders')
      .update({ calendar_token: token })
      .eq('id', leaderId);
    if (updError) return { ok: false, error: updError.message };
  }

  return {
    ok: true,
    token,
    url: buildLeaderCalendarAbsoluteUrl(token, origin),
  };
}
