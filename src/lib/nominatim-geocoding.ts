const cache = new Map<string, { lat: number; lng: number }>();

export type GeocodeResult = { lat: number; lng: number };

/** OpenStreetMap Nominatim — بدون مفتاح API (عبر /api/geocode) */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const key = query.trim();
  if (!key) return null;
  const cached = cache.get(key.toLowerCase());
  if (cached) return cached;

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: number; lng?: number };
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    const result = { lat: data.lat, lng: data.lng };
    cache.set(key.toLowerCase(), result);
    return result;
  } catch {
    return null;
  }
}
