import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sameCity } from '@/lib/trip-destination-normalize';

/**
 * Match itinerary stops to their places-bank rows: by bank id first, then by exact name (+ city).
 * Shared by opening hours and map positions.
 */

export type BankMatchItem = { key: string; bankId?: string | null; name?: string | null; city?: string | null };
export type BankRow = Record<string, unknown> & { id: string; name?: string; city?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBankId(v: unknown): boolean {
  const s = String(v ?? '').trim();
  return UUID_RE.test(s) || /^\d+$/.test(s);
}

export async function matchBankRows(
  db: SupabaseClient,
  items: BankMatchItem[],
  tag = 'places',
): Promise<{ rows: BankRow[]; byKey: Map<string, BankRow> }> {
  const ids = [...new Set(items.map((i) => String(i.bankId ?? '').trim()).filter(isBankId))];
  const rows: BankRow[] = [];
  if (ids.length) {
    const { data, error } = await db.from('places').select('*').in('id', ids.slice(0, 150));
    if (error) console.warn(`[${tag}] load by id:`, error.message);
    else rows.push(...((data ?? []) as BankRow[]));
  }
  const foundIds = new Set(rows.map((r) => String(r.id)));
  // Stops without a bank id (or with one that no longer exists) are matched by name + city
  const names = [
    ...new Set(
      items
        .filter((i) => !i.bankId || !foundIds.has(String(i.bankId)))
        .map((i) => String(i.name ?? '').trim())
        .filter(Boolean),
    ),
  ];
  if (names.length) {
    const { data, error } = await db.from('places').select('*').in('name', names.slice(0, 150));
    if (error) console.warn(`[${tag}] load by name:`, error.message);
    else rows.push(...((data ?? []) as BankRow[]));
  }

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const byKey = new Map<string, BankRow>();
  for (const item of items) {
    let row = item.bankId ? byId.get(String(item.bankId)) : undefined;
    if (!row && item.name) {
      const name = item.name.trim().toLowerCase();
      const candidates = rows.filter((r) => String(r.name ?? '').trim().toLowerCase() === name);
      row =
        candidates.find((r) => item.city && String(item.city).split(/[·,]/).some((c) => sameCity(String(r.city ?? ''), c))) ??
        (candidates.length === 1 ? candidates[0] : undefined);
    }
    if (row) byKey.set(item.key, row);
  }
  return { rows, byKey };
}
