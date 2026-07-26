import 'server-only';

import {
  partitionClientItineraries,
  resolveItineraryCost,
  resolveItineraryEndDate,
  resolveItineraryStartDate,
  type ClientItineraryBridge,
} from '@/lib/client-active-itinerary';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type UnifiedAdminTripRow = {
  id: string;
  destination: string;
  trip_date: string | null;
  end_date: string | null;
  cost: number;
  notes: string | null;
  status: string | null;
  viewUrl: string | null;
  backend: 'customer_trips' | 'client_trips' | 'itineraries';
};

/** Try both numeric and string forms — Postgres client_id typing varies. */
export function clientIdLookupKeys(clientId: string | number): Array<string | number> {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  if (!raw) return [];
  const keys: Array<string | number> = [raw];
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) keys.push(n);
  }
  return [...new Set(keys)];
}

function isNonTemplateItineraryRow(row: Record<string, unknown>): boolean {
  return row.is_template !== true;
}

function mergeItineraryRows(
  direct: Record<string, unknown>[] | null | undefined,
  memberNested: unknown[] | null | undefined,
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();

  for (const row of direct ?? []) {
    const id = String(row.id ?? '').trim();
    if (!id || !isNonTemplateItineraryRow(row)) continue;
    byId.set(id, row);
  }

  for (const entry of memberNested ?? []) {
    const rawItinerary = (entry as { itineraries?: unknown }).itineraries;
    const row = (Array.isArray(rawItinerary) ? rawItinerary[0] : rawItinerary) as
      | Record<string, unknown>
      | null
      | undefined;
    if (!row) continue;
    const id = String(row.id ?? '').trim();
    if (!id || !isNonTemplateItineraryRow(row)) continue;
    if (!byId.has(id)) byId.set(id, row);
  }

  return [...byId.values()];
}

function mapItineraryToUnified(row: Record<string, unknown>): UnifiedAdminTripRow {
  const id = String(row.id ?? '').trim();
  const destination =
    String(row.destination ?? '').trim() ||
    String(row.title ?? '').trim() ||
    'وجهة غير محددة';
  const start = resolveItineraryStartDate(row);
  const end = resolveItineraryEndDate(row);
  return {
    id,
    destination,
    trip_date: start,
    end_date: end,
    cost: resolveItineraryCost(row) || Number(row.expected_profit ?? 0) || 0,
    notes: String(row.title ?? '').trim() || null,
    status: row.status != null ? String(row.status) : null,
    viewUrl: id ? `/crm/itineraries/${id}/edit` : null,
    backend: 'itineraries',
  };
}

function resolveLegacyTripCost(
  row: Record<string, unknown>,
  backend: 'customer_trips' | 'client_trips',
): number {
  const revenue =
    Number(
      row.cost ??
        row.total_price ??
        row.total_cost ??
        row.amount ??
        row.revenue ??
        row.grand_total ??
        0,
    ) || 0;
  const profit = Number(row.profit ?? row.expected_profit ?? 0) || 0;
  // client_trips often stores only profit as the financial signal
  if (backend === 'client_trips') {
    return revenue > 0 ? revenue : profit;
  }
  return revenue > 0 ? revenue : profit;
}

function mapLegacyTrip(
  row: Record<string, unknown>,
  backend: 'customer_trips' | 'client_trips',
): UnifiedAdminTripRow {
  return {
    id: String(row.id),
    destination: String(row.destination ?? ''),
    trip_date: (row.trip_date as string | null) ?? null,
    end_date: null,
    cost: resolveLegacyTripCost(row, backend),
    notes: (row.notes as string | null) ?? null,
    status: null,
    viewUrl: null,
    backend,
  };
}

function sortUnifiedNewestFirst(rows: UnifiedAdminTripRow[]): UnifiedAdminTripRow[] {
  return [...rows].sort((a, b) => {
    const da = a.trip_date ?? a.end_date ?? '';
    const db = b.trip_date ?? b.end_date ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

async function fetchItinerariesForKeys(
  admin: AdminClient,
  keys: Array<string | number>,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const mergedDirect: Record<string, unknown>[] = [];
  const mergedMembers: unknown[] = [];
  let fatalError: string | null = null;

  for (const key of keys) {
    const [directRes, memberRes] = await Promise.all([
      admin
        .from('itineraries')
        .select('*')
        .eq('client_id', key)
        .order('id', { ascending: false }),
      admin
        .from('itinerary_client_members')
        .select('itinerary_id, itineraries (*)')
        .eq('client_id', key),
    ]);

    if (directRes.error) {
      fatalError = directRes.error.message;
      console.warn('[client-itineraries] direct lookup:', directRes.error.message, {
        key,
      });
    } else if (directRes.data?.length) {
      mergedDirect.push(...(directRes.data as Record<string, unknown>[]));
    }

    if (memberRes.error) {
      const msg = memberRes.error.message ?? '';
      if (
        !/itinerary_client_members|schema cache|relation|does not exist/i.test(msg)
      ) {
        console.warn('[client-itineraries] member lookup:', msg, { key });
      }
    } else if (memberRes.data?.length) {
      mergedMembers.push(...memberRes.data);
    }
  }

  const rows = mergeItineraryRows(mergedDirect, mergedMembers);
  // Prefer rows even if one key form errored — empty + error only when nothing found
  if (rows.length === 0 && fatalError) {
    return { rows: [], error: fatalError };
  }
  return { rows, error: null };
}

export async function fetchClientItineraryRowsAdmin(
  admin: AdminClient,
  clientId: string | number,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const keys = clientIdLookupKeys(clientId);
  if (!keys.length) return { rows: [], error: null };
  return fetchItinerariesForKeys(admin, keys);
}

export type ClientItinerariesBundle = {
  activeTrip: ClientItineraryBridge | null;
  pastTrips: ClientItineraryBridge[];
  allTrips: ClientItineraryBridge[];
  displayRow: Record<string, unknown> | null;
};

export async function loadClientItinerariesBundleAdmin(
  admin: AdminClient,
  clientId: string | number,
): Promise<{ bundle: ClientItinerariesBundle; error: string | null }> {
  const { rows, error } = await fetchClientItineraryRowsAdmin(admin, clientId);
  if (error) {
    return {
      bundle: { activeTrip: null, pastTrips: [], allTrips: [], displayRow: null },
      error,
    };
  }

  const { activeTrip, pastTrips, allTrips } = partitionClientItineraries(rows);

  const displayBridge = activeTrip ?? allTrips[0] ?? null;
  const displayRow =
    displayBridge != null
      ? rows.find((row) => String(row.id) === displayBridge.id) ?? null
      : null;

  return {
    bundle: { activeTrip, pastTrips, allTrips, displayRow },
    error: null,
  };
}

/** Full trip history for CRM client profile (itineraries + legacy tables). */
export async function fetchUnifiedClientTripsAdmin(
  admin: AdminClient,
  clientId: string | number,
): Promise<{ trips: UnifiedAdminTripRow[]; error: string | null }> {
  const keys = clientIdLookupKeys(clientId);
  if (!keys.length) return { trips: [], error: null };

  const { rows: itineraryRows, error } = await fetchItinerariesForKeys(admin, keys);
  if (error && itineraryRows.length === 0) {
    return { trips: [], error };
  }

  const merged: UnifiedAdminTripRow[] = [];
  const seen = new Set<string>();

  for (const row of itineraryRows) {
    const mapped = mapItineraryToUnified(row);
    if (!mapped.id || seen.has(`itineraries:${mapped.id}`)) continue;
    seen.add(`itineraries:${mapped.id}`);
    merged.push(mapped);
  }

  for (const key of keys) {
    const [primary, legacy] = await Promise.all([
      admin
        .from('customer_trips')
        .select('*')
        .eq('client_id', key)
        .order('created_at', { ascending: false }),
      admin
        .from('client_trips')
        .select('*')
        .eq('client_id', key)
        .order('created_at', { ascending: false }),
    ]);

    if (!primary.error && primary.data) {
      for (const row of primary.data) {
        const mapped = mapLegacyTrip(row as Record<string, unknown>, 'customer_trips');
        const dedupe = `customer_trips:${mapped.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    }

    if (!legacy.error && legacy.data) {
      for (const row of legacy.data) {
        const mapped = mapLegacyTrip(row as Record<string, unknown>, 'client_trips');
        const dedupe = `client_trips:${mapped.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    }
  }

  return { trips: sortUnifiedNewestFirst(merged), error: null };
}
