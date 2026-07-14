import 'server-only';

import type { ClientMemory } from '@/lib/client-profile-dashboard';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function coerceClientDbKey(clientId: string | number): string | number {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function isMissingTableError(message: string): boolean {
  return /client_memories|schema cache|relation|does not exist|could not find the table/i.test(
    message,
  );
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function pickDate(row: Record<string, unknown>, keys: string[]): string | null {
  const value = pickString(row, keys);
  return value ? value.slice(0, 10) : null;
}

function unwrapJoined<T extends Record<string, unknown>>(
  raw: unknown,
): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (typeof raw === 'object') return raw as T;
  return null;
}

export type CrmClientMemoryRow = {
  id: number | string;
  client_id: number | string;
  itinerary_id: number | string | null;
  image_url: string;
  caption: string | null;
  location_name: string | null;
  created_at: string;
  client_name: string;
  destination: string | null;
};

export function mapClientMemoryRow(row: Record<string, unknown>): ClientMemory {
  const locationName =
    pickString(row, ['location_name']) ??
    pickString(row, ['location', 'destination', 'trip_destination', 'city']);

  const joinedItinerary = unwrapJoined<{
    destination?: unknown;
    title?: unknown;
  }>(row.itineraries ?? row.itinerary);

  const destination =
    pickString(joinedItinerary ?? {}, ['destination', 'title']) ??
    pickString(row, ['destination', 'trip_destination']);

  return {
    id: String(row.id ?? '').trim(),
    clientId: row.client_id != null ? (row.client_id as string | number) : null,
    itineraryId: row.itinerary_id != null ? String(row.itinerary_id).trim() : null,
    title: pickString(row, ['title', 'headline', 'name']),
    caption: pickString(row, ['caption', 'description', 'note', 'notes']),
    location: locationName,
    locationName,
    imageUrl: pickString(row, ['image_url', 'photo_url', 'media_url', 'url']),
    memoryDate: pickDate(row, ['memory_date', 'trip_date', 'captured_at', 'created_at']),
    destination,
  };
}

function mapCrmMemoryRow(row: Record<string, unknown>): CrmClientMemoryRow | null {
  const id = row.id;
  const imageUrl = pickString(row, ['image_url', 'photo_url']);
  if (id == null || !imageUrl) return null;

  const client = unwrapJoined<{ name?: unknown }>(row.clients ?? row.client);
  const itinerary = unwrapJoined<{ destination?: unknown; title?: unknown }>(
    row.itineraries ?? row.itinerary,
  );

  const clientId = row.client_id as string | number;
  const clientName =
    pickString(client ?? {}, ['name']) || `عميل #${clientId}`;

  const destination =
    pickString(itinerary ?? {}, ['destination', 'title']) || null;

  return {
    id: id as number | string,
    client_id: clientId,
    itinerary_id: row.itinerary_id != null ? (row.itinerary_id as string | number) : null,
    image_url: imageUrl,
    caption: pickString(row, ['caption']),
    location_name: pickString(row, ['location_name', 'location']),
    created_at: String(row.created_at ?? ''),
    client_name: clientName,
    destination,
  };
}

export async function fetchClientMemoriesAdmin(
  admin: AdminClient,
  clientId: string | number,
): Promise<{ memories: ClientMemory[]; error: string | null }> {
  const clientKey = coerceClientDbKey(clientId);

  const withJoin = await admin
    .from('client_memories')
    .select(
      'id, client_id, itinerary_id, image_url, caption, location_name, location, memory_date, created_at, itineraries(destination, title)',
    )
    .eq('client_id', clientKey)
    .order('created_at', { ascending: false });

  let rows = withJoin.data;
  let error = withJoin.error;

  if (error) {
    if (isMissingTableError(error.message ?? '')) {
      return { memories: [], error: null };
    }

    // Fallback without join (FK name/schema variance)
    const plain = await admin
      .from('client_memories')
      .select('*')
      .eq('client_id', clientKey)
      .order('created_at', { ascending: false });

    if (plain.error) {
      if (isMissingTableError(plain.error.message ?? '')) {
        return { memories: [], error: null };
      }
      return { memories: [], error: plain.error.message };
    }

    rows = plain.data;
    error = null;
  }

  return {
    memories: (rows ?? [])
      .map((row) => mapClientMemoryRow(row as Record<string, unknown>))
      .filter((memory) => memory.id.length > 0 && Boolean(memory.imageUrl)),
    error: null,
  };
}

export async function fetchAllClientMemoriesAdmin(
  admin: AdminClient,
): Promise<{ memories: CrmClientMemoryRow[]; error: string | null }> {
  const withJoin = await admin
    .from('client_memories')
    .select(
      `
      id,
      client_id,
      itinerary_id,
      image_url,
      caption,
      location_name,
      created_at,
      clients ( name ),
      itineraries ( destination, title )
    `,
    )
    .order('created_at', { ascending: false });

  if (!withJoin.error && withJoin.data) {
    return {
      memories: (withJoin.data as Record<string, unknown>[])
        .map(mapCrmMemoryRow)
        .filter((row): row is CrmClientMemoryRow => row != null),
      error: null,
    };
  }

  if (withJoin.error && isMissingTableError(withJoin.error.message ?? '')) {
    return { memories: [], error: null };
  }

  const plain = await admin
    .from('client_memories')
    .select('id, client_id, itinerary_id, image_url, caption, location_name, created_at')
    .order('created_at', { ascending: false });

  if (plain.error) {
    if (isMissingTableError(plain.error.message ?? '')) {
      return { memories: [], error: null };
    }
    return {
      memories: [],
      error: plain.error.message || withJoin.error?.message || 'fetch_failed',
    };
  }

  const rows = (plain.data ?? []) as Record<string, unknown>[];
  const clientIds = [
    ...new Set(
      rows
        .map((r) => r.client_id)
        .filter((id) => id != null)
        .map((id) => String(id)),
    ),
  ];
  const itineraryIds = [
    ...new Set(
      rows
        .map((r) => r.itinerary_id)
        .filter((id) => id != null)
        .map((id) => String(id)),
    ),
  ];

  const clientNameById = new Map<string, string>();
  const destByItineraryId = new Map<string, string>();

  if (clientIds.length > 0) {
    const { data: clients } = await admin
      .from('clients')
      .select('id, name')
      .in(
        'id',
        clientIds.map((id) => (/^\d+$/.test(id) ? Number(id) : id)),
      );
    for (const c of clients ?? []) {
      const row = c as { id?: unknown; name?: unknown };
      if (row.id == null) continue;
      clientNameById.set(
        String(row.id),
        String(row.name ?? '').trim() || `عميل #${row.id}`,
      );
    }
  }

  if (itineraryIds.length > 0) {
    const { data: itineraries } = await admin
      .from('itineraries')
      .select('id, destination, title')
      .in(
        'id',
        itineraryIds.map((id) => (/^\d+$/.test(id) ? Number(id) : id)),
      );
    for (const it of itineraries ?? []) {
      const row = it as { id?: unknown; destination?: unknown; title?: unknown };
      if (row.id == null) continue;
      const dest =
        String(row.destination ?? '').trim() ||
        String(row.title ?? '').trim() ||
        '';
      if (dest) destByItineraryId.set(String(row.id), dest);
    }
  }

  return {
    memories: rows
      .map((row) => {
        const mapped = mapCrmMemoryRow(row);
        if (!mapped) return null;
        return {
          ...mapped,
          client_name:
            clientNameById.get(String(mapped.client_id)) || mapped.client_name,
          destination:
            mapped.destination ||
            (mapped.itinerary_id
              ? destByItineraryId.get(String(mapped.itinerary_id)) ?? null
              : null),
        };
      })
      .filter((row): row is CrmClientMemoryRow => row != null),
    error: null,
  };
}
