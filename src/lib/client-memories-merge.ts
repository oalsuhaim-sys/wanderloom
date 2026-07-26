export type RawMemoryRow = Record<string, unknown>;

export type RawClientRow = {
  id: unknown;
  name?: unknown;
};

export type RawItineraryRow = {
  id: unknown;
  title?: unknown;
  destination?: unknown;
  client_id?: unknown;
};

export type EnrichedCrmMemory = {
  id: number | string;
  client_id: number | string | null;
  itinerary_id: number | string | null;
  image_url: string;
  caption?: string | null;
  location_name?: string | null;
  location?: string | null;
  created_at?: string | null;
  client_name: string;
  destination: string | null;
  map_url?: string | null;
  clients: { id: number | string; name: string };
  itineraries: { id: number | string; title: string };
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function resolveItineraryTitle(
  itinerary: RawItineraryRow | null,
  itineraryId: unknown,
): string {
  const fromRow =
    pickString(itinerary ?? {}, ['destination', 'title']) ?? null;
  if (fromRow) return fromRow;
  if (itineraryId != null && String(itineraryId).trim() !== '') {
    return `مسار #${itineraryId}`;
  }
  return 'مسار غير معروف';
}

/**
 * Merges client_memories + clients + itineraries in JS — no FK joins required.
 *
 * Dynamic resolution: when a memory is linked to an itinerary, the itinerary's
 * current `client_id` (CRM assignment) is authoritative. Falls back to the
 * memory row's `client_id` only when no itinerary link exists.
 */
export function enrichClientMemories(
  memories: RawMemoryRow[],
  clients: RawClientRow[],
  itineraries: RawItineraryRow[],
): EnrichedCrmMemory[] {
  const clientById = new Map<string, RawClientRow>();
  for (const client of clients) {
    if (client.id != null) clientById.set(String(client.id), client);
  }

  const itineraryById = new Map<string, RawItineraryRow>();
  for (const itinerary of itineraries) {
    if (itinerary.id != null) itineraryById.set(String(itinerary.id), itinerary);
  }

  const enriched: EnrichedCrmMemory[] = [];

  for (const memory of memories) {
    const imageUrl = pickString(memory, ['image_url', 'photo_url']);
    if (memory.id == null || !imageUrl) continue;

    const itineraryId = memory.itinerary_id;

    // 1. Find the trip this memory belongs to
    const matchedItinerary =
      itineraryId != null ? itineraryById.get(String(itineraryId)) ?? null : null;

    const itineraryClientId =
      matchedItinerary?.client_id != null &&
      String(matchedItinerary.client_id).trim() !== ''
        ? matchedItinerary.client_id
        : null;

    const memoryClientId =
      memory.client_id != null && String(memory.client_id).trim() !== ''
        ? memory.client_id
        : null;

    // 2. SMART RESOLUTION: itinerary assignment wins (handles late CRM linking + orphans)
    // 3. Fallback to memory.client_id when no itinerary or itinerary has no client
    const resolvedClientId = itineraryClientId ?? memoryClientId ?? null;

    // 4. Resolve client name from the derived ID
    const matchedClient =
      resolvedClientId != null
        ? clientById.get(String(resolvedClientId)) ?? null
        : null;

    const clientName =
      pickString(matchedClient ?? {}, ['name']) ??
      (resolvedClientId != null ? `عميل #${resolvedClientId}` : 'غير معيّن');

    const itineraryTitle = resolveItineraryTitle(matchedItinerary, itineraryId);
    const itineraryDestination =
      pickString(matchedItinerary ?? {}, ['destination']) ??
      (itineraryTitle !== 'مسار غير معروف' ? itineraryTitle : null);
    const tripDisplayName =
      pickString(matchedItinerary ?? {}, ['title']) ??
      itineraryDestination ??
      (itineraryTitle !== 'مسار غير معروف' ? itineraryTitle : null);

    enriched.push({
      id: memory.id as number | string,
      client_id: resolvedClientId as number | string | null,
      itinerary_id:
        itineraryId != null ? (itineraryId as number | string) : null,
      image_url: imageUrl,
      caption: pickString(memory, ['caption', 'notes']),
      location_name: pickString(memory, ['location_name', 'location']),
      location: pickString(memory, ['location']),
      created_at: memory.created_at != null ? String(memory.created_at) : null,
      client_name: clientName,
      destination: itineraryDestination,
      map_url: pickString(memory, [
        'map_url',
        'maps_url',
        'location_url',
        'location_link',
        'google_maps_url',
        'google_maps_link',
      ]),
      clients: matchedClient
        ? {
            id: matchedClient.id as number | string,
            name: clientName,
          }
        : { id: 'unassigned', name: 'غير معيّن' },
      itineraries: matchedItinerary
        ? {
            id: matchedItinerary.id as number | string,
            title: tripDisplayName || itineraryTitle,
          }
        : { id: 'unassigned', title: 'مسار غير معروف' },
    });
  }

  return enriched.sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  );
}
