import { supabase } from '@/lib/supabase';
import {
  resolveItineraryCost,
  resolveItineraryEndDate,
  resolveItineraryStartDate,
} from '@/lib/client-active-itinerary';

export type UnifiedTripRow = {
  id: string;
  destination: string;
  trip_date: string | null;
  end_date?: string | null;
  cost: number;
  notes?: string | null;
  status?: string | null;
  viewUrl?: string | null;
  backend: 'customer_trips' | 'client_trips' | 'itineraries';
};

function mapCustomerTrip(row: Record<string, unknown>): UnifiedTripRow {
  return {
    id: String(row.id),
    destination: String(row.destination ?? ''),
    trip_date: (row.trip_date as string | null) ?? null,
    cost: Number(row.cost ?? 0),
    notes: (row.notes as string | null) ?? null,
    backend: 'customer_trips',
  };
}

function mapClientTrip(row: Record<string, unknown>): UnifiedTripRow {
  return {
    id: String(row.id),
    destination: String(row.destination ?? ''),
    trip_date: (row.trip_date as string | null) ?? null,
    cost: Number(row.profit ?? row.cost ?? 0),
    notes: (row.notes as string | null) ?? null,
    backend: 'client_trips',
  };
}

function mapItineraryTrip(row: Record<string, unknown>): UnifiedTripRow {
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

function sortTripsNewestFirst(rows: UnifiedTripRow[]): UnifiedTripRow[] {
  return [...rows].sort((a, b) => {
    const da = a.trip_date ?? a.end_date ?? '';
    const db = b.trip_date ?? b.end_date ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

function clientIdLookupKeys(clientId: string): Array<string | number> {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  if (!raw) return [];
  const keys: Array<string | number> = [raw];
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) keys.push(n);
  }
  return [...new Set(keys)];
}

const ITINERARY_LIST_SELECT =
  'id, title, destination, dates, start_date, end_date, status, expected_profit, total_estimated_cost, is_template, client_id';

/** يجمع الرحلات من itineraries (+ سجلات customer_trips / client_trips القديمة). */
export async function fetchUnifiedClientTrips(clientId: string): Promise<UnifiedTripRow[]> {
  if (!supabase || !clientId) return [];

  const keys = clientIdLookupKeys(clientId);
  const merged: UnifiedTripRow[] = [];
  const seen = new Set<string>();

  for (const clientKey of keys) {
    // Source of truth: CRM itineraries linked to this client
    // Use a minimal column set — missing optional columns used to empty the whole list.
    const itinerariesRes = await supabase
      .from('itineraries')
      .select(ITINERARY_LIST_SELECT)
      .eq('client_id', clientKey)
      .order('id', { ascending: false });

    if (!itinerariesRes.error && itinerariesRes.data?.length) {
      for (const row of itinerariesRes.data) {
        const r = row as Record<string, unknown>;
        if (r.is_template === true) continue;
        const mapped = mapItineraryTrip(r);
        const dedupe = `itineraries:${mapped.id}`;
        if (!mapped.id || seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    } else if (itinerariesRes.error) {
      console.error('[client-trips-crm] itineraries lookup:', itinerariesRes.error.message);
    }

    // Also include group memberships
    const memberRes = await supabase
      .from('itinerary_client_members')
      .select(
        `itinerary_id, itineraries (${ITINERARY_LIST_SELECT})`,
      )
      .eq('client_id', clientKey);

    if (!memberRes.error && memberRes.data?.length) {
      for (const entry of memberRes.data) {
        const raw = (entry as { itineraries?: unknown }).itineraries;
        const row = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
        if (!row || row.is_template === true) continue;
        const mapped = mapItineraryTrip(row);
        const dedupe = `itineraries:${mapped.id}`;
        if (!mapped.id || seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    }

    const primary = await supabase
      .from('customer_trips')
      .select('*')
      .eq('client_id', clientKey)
      .order('created_at', { ascending: false });

    if (!primary.error && primary.data?.length) {
      for (const row of primary.data) {
        const mapped = mapCustomerTrip(row as Record<string, unknown>);
        const dedupe = `customer_trips:${mapped.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    }

    const legacy = await supabase
      .from('client_trips')
      .select('*')
      .eq('client_id', clientKey)
      .order('created_at', { ascending: false });

    if (!legacy.error && legacy.data?.length) {
      for (const row of legacy.data) {
        const mapped = mapClientTrip(row as Record<string, unknown>);
        const dedupe = `client_trips:${mapped.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        merged.push(mapped);
      }
    }
  }

  return sortTripsNewestFirst(merged);
}

/** مجموع الربح/القيمة من الرحلات الموحّدة. */
export function sumUnifiedTripProfit(trips: UnifiedTripRow[]): number {
  return trips.reduce((sum, trip) => sum + (Number(trip.cost) || 0), 0);
}

/** إجمالي الأرباح لمجموعة عملاء (للبطاقات في قائمة CRM). */
export async function sumClientTripProfitByClientIds(
  clientIds: string[],
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const id of clientIds) totals[id] = 0;
  if (!supabase || !clientIds.length) return totals;

  const keys = clientIds.flatMap(clientIdLookupKeys);

  const [itineraries, primary, legacy] = await Promise.all([
    supabase
      .from('itineraries')
      .select('client_id, expected_profit, total_estimated_cost, is_template')
      .in('client_id', keys),
    supabase.from('customer_trips').select('client_id, cost').in('client_id', keys),
    supabase.from('client_trips').select('client_id, profit').in('client_id', keys),
  ]);

  for (const row of itineraries.data ?? []) {
    const r = row as {
      client_id: unknown;
      expected_profit?: unknown;
      total_estimated_cost?: unknown;
      is_template?: unknown;
    };
    if (r.is_template === true) continue;
    const id = String(r.client_id);
    if (id in totals) {
      totals[id] +=
        Number(r.expected_profit ?? 0) || Number(r.total_estimated_cost ?? 0) || 0;
    }
  }

  for (const row of primary.data ?? []) {
    const r = row as { client_id: unknown; cost: unknown };
    const id = String(r.client_id);
    if (id in totals) totals[id] += Number(r.cost ?? 0);
  }

  for (const row of legacy.data ?? []) {
    const r = row as { client_id: unknown; profit: unknown };
    const id = String(r.client_id);
    if (id in totals) totals[id] += Number(r.profit ?? 0);
  }

  return totals;
}

/** عدّ الرحلات لعميل واحد. */
export async function countClientTrips(clientId: string): Promise<number> {
  if (!supabase || !clientId) return 0;
  const rows = await fetchUnifiedClientTrips(clientId);
  return rows.length;
}

/** عدّ الرحلات لمجموعة عملاء (للبطاقات في قائمة CRM). */
export async function countClientTripsByClientIds(
  clientIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of clientIds) counts[id] = 0;
  if (!supabase || !clientIds.length) return counts;

  const keys = clientIds.flatMap(clientIdLookupKeys);

  const [itineraries, primary, legacy] = await Promise.all([
    supabase
      .from('itineraries')
      .select('client_id, is_template')
      .in('client_id', keys),
    supabase.from('customer_trips').select('client_id').in('client_id', keys),
    supabase.from('client_trips').select('client_id').in('client_id', keys),
  ]);

  for (const row of itineraries.data ?? []) {
    const r = row as { client_id: unknown; is_template?: unknown };
    if (r.is_template === true) continue;
    const id = String(r.client_id);
    if (id in counts) counts[id] += 1;
  }

  for (const row of primary.data ?? []) {
    const id = String((row as { client_id: unknown }).client_id);
    if (id in counts) counts[id] += 1;
  }

  for (const row of legacy.data ?? []) {
    const id = String((row as { client_id: unknown }).client_id);
    if (id in counts) counts[id] += 1;
  }

  return counts;
}
