import { supabase } from '@/lib/supabase';

export type UnifiedTripRow = {
  id: string;
  destination: string;
  trip_date: string | null;
  cost: number;
  notes?: string | null;
  backend: 'customer_trips' | 'client_trips';
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

function sortTripsNewestFirst(rows: UnifiedTripRow[]): UnifiedTripRow[] {
  return [...rows].sort((a, b) => {
    const da = a.trip_date ?? '';
    const db = b.trip_date ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

/** يجمع الرحلات من customer_trips و client_trips (السجل القديم). */
export async function fetchUnifiedClientTrips(clientId: string): Promise<UnifiedTripRow[]> {
  if (!supabase || !clientId) return [];

  const merged: UnifiedTripRow[] = [];

  const primary = await supabase
    .from('customer_trips')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (!primary.error && primary.data?.length) {
    merged.push(...primary.data.map((row) => mapCustomerTrip(row as Record<string, unknown>)));
  } else if (primary.error) {
    const msg = String(primary.error.message || '').toLowerCase();
    if (!msg.includes('customer_trips') && !msg.includes('schema cache')) {
      console.error(primary.error);
    }
  }

  const legacy = await supabase
    .from('client_trips')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (!legacy.error && legacy.data?.length) {
    merged.push(...legacy.data.map((row) => mapClientTrip(row as Record<string, unknown>)));
  } else if (legacy.error) {
    const msg = String(legacy.error.message || '').toLowerCase();
    if (!msg.includes('client_trips') && !msg.includes('schema cache')) {
      console.error(legacy.error);
    }
  }

  return sortTripsNewestFirst(merged);
}

/** مجموع الربح/القيمة من الرحلات الموحّدة (profit في client_trips، cost في customer_trips). */
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

  const [primary, legacy] = await Promise.all([
    supabase.from('customer_trips').select('client_id, cost').in('client_id', clientIds),
    supabase.from('client_trips').select('client_id, profit').in('client_id', clientIds),
  ]);

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

/** عدّ الرحلات لعميل واحد (استعلام count من الجدولين). */
export async function countClientTrips(clientId: string): Promise<number> {
  if (!supabase || !clientId) return 0;

  let total = 0;

  const primary = await supabase
    .from('customer_trips')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (!primary.error && primary.count != null) {
    total += primary.count;
  }

  const legacy = await supabase
    .from('client_trips')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (!legacy.error && legacy.count != null) {
    total += legacy.count;
  }

  return total;
}

/** عدّ الرحلات لمجموعة عملاء (للبطاقات في قائمة CRM). */
export async function countClientTripsByClientIds(
  clientIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of clientIds) counts[id] = 0;
  if (!supabase || !clientIds.length) return counts;

  const [primary, legacy] = await Promise.all([
    supabase.from('customer_trips').select('client_id').in('client_id', clientIds),
    supabase.from('client_trips').select('client_id').in('client_id', clientIds),
  ]);

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
