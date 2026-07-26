import 'server-only';

import type { ClientMemory } from '@/lib/client-profile-dashboard';
import { enrichClientMemories, type EnrichedCrmMemory } from '@/lib/client-memories-merge';
import {
  collectItineraryStopsFromDaysData,
  collectPlaceMapsUrlsFromDaysData,
  isDayOrCityLabelOnly,
  isPlaceholderLocationName,
  matchStopForMemory,
  resolveMemoryGoogleMapsUrl,
  type ItineraryStopPlace,
} from '@/lib/memory-maps-url';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function coerceClientDbKey(clientId: string | number): string | number {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function clientIdLookupKeys(clientId: string | number): Array<string | number> {
  const raw = String(clientId ?? '').trim().replace(/^(client-|vip-)/i, '');
  if (!raw) return [];
  const keys: Array<string | number> = [raw];
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) keys.push(n);
  }
  return [...new Set(keys)];
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
  client_id: number | string | null;
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
    pickString(row, ['location_name', 'place', 'station']) ??
    pickString(row, ['location']);

  const joinedItinerary = unwrapJoined<{
    destination?: unknown;
    title?: unknown;
  }>(row.itineraries ?? row.itinerary);

  const destination =
    pickString(joinedItinerary ?? {}, ['destination']) ??
    pickString(row, ['destination', 'trip_destination', 'city']);

  const tripName =
    pickString(row, ['trip_name', 'tripName', 'itinerary_title']) ??
    pickString(joinedItinerary ?? {}, ['title']) ??
    pickString(joinedItinerary ?? {}, ['destination']);

  const mapUrl = pickString(row, [
    'map_url',
    'maps_url',
    'location_url',
    'location_link',
    'google_maps_url',
    'google_maps_link',
  ]);

  return {
    id: String(row.id ?? '').trim(),
    clientId: row.client_id != null ? (row.client_id as string | number) : null,
    itineraryId: row.itinerary_id != null ? String(row.itinerary_id).trim() : null,
    title: pickString(row, ['title', 'headline', 'name', 'place', 'station']),
    caption: pickString(row, ['caption', 'description', 'note', 'notes']),
    location: locationName,
    locationName,
    imageUrl: pickString(row, ['image_url', 'photo_url', 'media_url', 'url']),
    memoryDate: pickDate(row, ['memory_date', 'trip_date', 'captured_at', 'created_at']),
    destination,
    tripName,
    mapUrl,
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

function isDeletedMemoryRow(row: Record<string, unknown>): boolean {
  if (row.is_deleted === true || row.is_deleted === 1 || row.is_deleted === 'true') {
    return true;
  }
  if (row.deleted === true || row.deleted === 1 || row.deleted === 'true') {
    return true;
  }
  const deletedAt = row.deleted_at ?? row.deletedAt;
  if (deletedAt != null && String(deletedAt).trim() !== '') {
    return true;
  }
  const status = String(row.status ?? row.approval_status ?? '')
    .trim()
    .toLowerCase();
  return (
    status === 'deleted' ||
    status === 'removed' ||
    status === 'trashed' ||
    status === 'محذوف'
  );
}

function isApprovedMemoryRow(row: Record<string, unknown>): boolean {
  if (isDeletedMemoryRow(row)) return false;

  // Rows in client_memories are the CRM “معتمد” archive.
  // If a status column exists, only keep approved/saved/published.
  if (!('status' in row) && !('approval_status' in row) && !('is_approved' in row)) {
    return true;
  }
  if (row.is_approved === true || row.is_approved === 1 || row.is_approved === 'true') {
    return true;
  }
  const status = String(row.status ?? row.approval_status ?? '')
    .trim()
    .toLowerCase();
  if (!status) return true;
  return (
    status === 'approved' ||
    status === 'saved' ||
    status === 'published' ||
    status === 'معتمد' ||
    status === 'active'
  );
}

function hasUsableImageUrl(row: Record<string, unknown>): boolean {
  const url = pickString(row, ['image_url', 'photo_url', 'media_url', 'url']);
  if (!url) return false;
  // Reject obvious placeholders / empty storage leftovers
  if (/^(null|undefined|none|n\/a)$/i.test(url)) return false;
  return true;
}

/**
 * Portal/CRM: approved memories for a client.
 * Resolves via memory.client_id OR itineraries.client_id (same as CRM library).
 */
export async function fetchClientMemoriesAdmin(
  admin: AdminClient,
  clientId: string | number,
): Promise<{ memories: ClientMemory[]; error: string | null }> {
  const keys = clientIdLookupKeys(clientId);
  const keySet = new Set(keys.map(String));

  // Soft-delete filters are applied in JS after select('*') so missing
  // is_deleted / deleted_at columns never break the query.
  let memoriesData: Record<string, unknown>[] | null = null;
  let memoriesError: { message?: string } | null = null;

  {
    const joined = await admin
      .from('client_memories')
      .select('*, itineraries(id, title, destination, days_data)')
      .order('created_at', { ascending: false });
    if (!joined.error) {
      memoriesData = (joined.data ?? []) as Record<string, unknown>[];
    } else if (isMissingTableError(joined.error.message ?? '')) {
      return { memories: [], error: null };
    } else if (/foreign key|relationship|embed|itineraries|Could not find/i.test(joined.error.message ?? '')) {
      const plainAll = await admin
        .from('client_memories')
        .select('*')
        .order('created_at', { ascending: false });
      if (!plainAll.error) {
        memoriesData = (plainAll.data ?? []) as Record<string, unknown>[];
      } else {
        memoriesError = plainAll.error;
      }
    } else {
      memoriesError = joined.error;
    }
  }

  const itinerariesRes = await admin
    .from('itineraries')
    .select('id, title, destination, client_id, days_data')
    .or('is_template.is.null,is_template.eq.false');

  if (memoriesError || memoriesData == null) {
    if (isMissingTableError(memoriesError?.message ?? '')) {
      return { memories: [], error: null };
    }
    // Narrow fallback: direct client_id match only
    for (const key of keys) {
      const plain = await admin
        .from('client_memories')
        .select('*')
        .eq('client_id', key)
        .order('created_at', { ascending: false });
      if (!plain.error && plain.data?.length) {
        return {
          memories: (plain.data as Record<string, unknown>[])
            .filter((row) => isApprovedMemoryRow(row) && hasUsableImageUrl(row))
            .map(mapClientMemoryRow)
            .filter((m) => m.id.length > 0 && Boolean(m.imageUrl)),
          error: null,
        };
      }
    }
    return { memories: [], error: memoriesError?.message ?? 'lookup_failed' };
  }

  const liveMemoryRows = memoriesData.filter(
    (row) => isApprovedMemoryRow(row) && hasUsableImageUrl(row),
  );

  const itineraryRows = (itinerariesRes.data ?? []) as Array<{
    id: unknown;
    title?: unknown;
    destination?: unknown;
    client_id?: unknown;
    days_data?: unknown;
  }>;

  const placeMapsByItinerary = new Map<string, Map<string, string>>();
  const stopsByItinerary = new Map<string, ItineraryStopPlace[]>();
  for (const trip of itineraryRows) {
    if (trip.id == null) continue;
    const id = String(trip.id);
    placeMapsByItinerary.set(id, collectPlaceMapsUrlsFromDaysData(trip.days_data));
    stopsByItinerary.set(id, collectItineraryStopsFromDaysData(trip.days_data));
  }

  // Also harvest stops from joined itineraries on memory rows
  for (const row of liveMemoryRows) {
    const joined = unwrapJoined<{ id?: unknown; days_data?: unknown }>(
      row.itineraries ?? row.itinerary,
    );
    if (!joined?.id) continue;
    const id = String(joined.id);
    if (!stopsByItinerary.has(id)) {
      stopsByItinerary.set(id, collectItineraryStopsFromDaysData(joined.days_data));
      placeMapsByItinerary.set(id, collectPlaceMapsUrlsFromDaysData(joined.days_data));
    }
  }

  // Resolve places-bank names/cities for stop place ids
  const placeIds = [
    ...new Set(
      [...stopsByItinerary.values()]
        .flat()
        .map((s) => s.placesBankId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const placeBankById = new Map<string, { name: string; city: string | null }>();
  if (placeIds.length) {
    const placesRes = await admin
      .from('places')
      .select('id, name, city')
      .in('id', placeIds);
    if (!placesRes.error && placesRes.data) {
      for (const place of placesRes.data as Array<Record<string, unknown>>) {
        const id = String(place.id ?? '').trim();
        const name = String(place.name ?? '').trim();
        if (!id || !name) continue;
        placeBankById.set(id, {
          name,
          city: String(place.city ?? '').trim() || null,
        });
      }
    }
  }

  const enriched = enrichClientMemories(
    liveMemoryRows,
    [{ id: clientId }],
    itineraryRows,
  );

  const matched = enriched.filter((row) => {
    const resolved = row.client_id != null ? String(row.client_id) : '';
    return resolved && keySet.has(resolved);
  });

  // Also keep direct client_id matches that enrich may have dropped
  const directRows = liveMemoryRows.filter((row) => {
    const cid = row.client_id != null ? String(row.client_id) : '';
    return cid && keySet.has(cid);
  });

  const byId = new Map<string, ClientMemory>();

  const attachStationContext = (mapped: ClientMemory): ClientMemory => {
    const itineraryId = mapped.itineraryId ? String(mapped.itineraryId) : null;
    const stops = itineraryId ? stopsByItinerary.get(itineraryId) ?? [] : [];
    const index = itineraryId ? placeMapsByItinerary.get(itineraryId) ?? null : null;
    const matchedStop = matchStopForMemory(mapped, stops);

    let stationName = mapped.stationName?.trim() || null;
    let city = mapped.city?.trim() || null;
    let placeId = mapped.placeId?.trim() || null;
    let mapUrl = resolveMemoryGoogleMapsUrl(mapped, index) || mapped.mapUrl || null;
    let locationName = mapped.locationName;

    if (matchedStop) {
      stationName = matchedStop.placeName;
      if (matchedStop.city) city = matchedStop.city;
      if (matchedStop.mapUrl) mapUrl = matchedStop.mapUrl;
      if (matchedStop.placesBankId) placeId = matchedStop.placesBankId;

      const bank = matchedStop.placesBankId
        ? placeBankById.get(matchedStop.placesBankId)
        : null;
      if (bank) {
        stationName = bank.name || stationName;
        if (bank.city) city = bank.city;
      }

      if (
        !locationName ||
        isPlaceholderLocationName(locationName) ||
        isDayOrCityLabelOnly(locationName, city)
      ) {
        locationName = stationName;
      }
    }

    if (
      stationName &&
      (isPlaceholderLocationName(stationName) ||
        isDayOrCityLabelOnly(stationName, city))
    ) {
      stationName = null;
    }

    if (!city && mapped.destination?.trim()) {
      city = mapped.destination.trim();
    }

    return {
      ...mapped,
      locationName,
      location: mapped.location || locationName,
      stationName,
      city,
      placeId,
      mapUrl,
    };
  };

  for (const row of matched) {
    if (!isApprovedMemoryRow(row as unknown as Record<string, unknown>)) continue;
    const mapped = mapClientMemoryRow({
      id: row.id,
      client_id: row.client_id,
      itinerary_id: row.itinerary_id,
      image_url: row.image_url,
      caption: row.caption,
      location_name: row.location_name ?? row.location,
      created_at: row.created_at,
      destination: row.destination,
      trip_name: row.itineraries?.title ?? row.destination,
      map_url: row.map_url,
      itineraries: row.itineraries,
    });
    if (mapped.id && mapped.imageUrl) byId.set(mapped.id, attachStationContext(mapped));
  }

  for (const row of directRows) {
    const mapped = mapClientMemoryRow(row);
    if (mapped.id && mapped.imageUrl) byId.set(mapped.id, attachStationContext(mapped));
  }

  return {
    memories: [...byId.values()],
    error: null,
  };
}

export async function fetchAllClientMemoriesAdmin(
  admin: AdminClient,
): Promise<{ memories: EnrichedCrmMemory[]; error: string | null }> {
  const [memoriesRes, clientsRes, itinerariesRes] = await Promise.all([
    admin
      .from('client_memories')
      .select('*')
      .order('created_at', { ascending: false }),
    admin.from('clients').select('id, name'),
    admin.from('itineraries').select('id, title, destination, client_id'),
  ]);

  if (memoriesRes.error) {
    if (isMissingTableError(memoriesRes.error.message ?? '')) {
      return { memories: [], error: null };
    }
    return { memories: [], error: memoriesRes.error.message };
  }

  if (clientsRes.error && !isMissingTableError(clientsRes.error.message ?? '')) {
    console.warn('[client-memories] clients fetch:', clientsRes.error.message);
  }

  if (itinerariesRes.error && !isMissingTableError(itinerariesRes.error.message ?? '')) {
    console.warn('[client-memories] itineraries fetch:', itinerariesRes.error.message);
  }

  const enriched = enrichClientMemories(
    ((memoriesRes.data ?? []) as Record<string, unknown>[]).filter(
      (row) => isApprovedMemoryRow(row) && hasUsableImageUrl(row),
    ),
    (clientsRes.data ?? []) as Array<{ id: unknown; name?: unknown }>,
    (itinerariesRes.data ?? []) as Array<{
      id: unknown;
      title?: unknown;
      destination?: unknown;
      client_id?: unknown;
    }>,
  );

  return {
    memories: enriched,
    error: null,
  };
}

export { coerceClientDbKey, mapCrmMemoryRow };
