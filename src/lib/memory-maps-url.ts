import type { ClientMemory } from '@/lib/client-profile-dashboard';

const PLACEHOLDER_LOCATION_RE =
  /^(محطة\s*مختارة|محطة|معلق|بانتظار|مرفوع من الإدارة|بدون موقع|unknown|n\/a|none|انتقال\s*\/?\s*مواصلات)$/i;

const DAY_TITLE_RE =
  /^(اليوم(\s|$|ال)|day\s*\d+|اليوم\s*(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر))/i;

export function isPlaceholderLocationName(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;
  return PLACEHOLDER_LOCATION_RE.test(text);
}

/** Day headers like "اليوم الأول" must never be shown as a landmark. */
export function isDayOrCityLabelOnly(
  value: string | null | undefined,
  cityHint?: string | null,
): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (DAY_TITLE_RE.test(text)) return true;
  const city = String(cityHint ?? '').trim();
  if (city && text === city) return true;
  return false;
}

export function isRealGoogleMapsUrl(value: string | null | undefined): boolean {
  const url = String(value ?? '').trim();
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes('google.') ||
      host.includes('maps.app.goo.gl') ||
      host.includes('goo.gl') ||
      host.includes('maps.apple.com') ||
      host.includes('openstreetmap.org')
    );
  } catch {
    return false;
  }
}

function pickMapsUrlFromObject(obj: Record<string, unknown>): string | null {
  for (const key of [
    'google_maps_url',
    'maps_url',
    'map_url',
    'google_maps_link',
    'location_url',
    'location_link',
  ] as const) {
    const raw = obj[key];
    if (raw == null) continue;
    const text = String(raw).trim();
    if (isRealGoogleMapsUrl(text)) return text;
  }
  return null;
}

/**
 * Exact landmark only — prefer place_name.
 * Never use day.title (e.g. "اليوم الأول").
 */
function pickStopPlaceName(obj: Record<string, unknown>): string | null {
  const placeName = String(obj.place_name ?? '').trim();
  if (
    placeName &&
    !isPlaceholderLocationName(placeName) &&
    !isDayOrCityLabelOnly(placeName)
  ) {
    return placeName;
  }

  const looksLikeStop =
    obj.places_bank_id != null ||
    obj.maps_url != null ||
    obj.google_maps_url != null ||
    obj.visit_time != null ||
    obj.time_slot != null ||
    (obj.category != null && String(obj.category).trim() !== '');

  if (!looksLikeStop) return null;

  const name = String(obj.name ?? '').trim();
  if (name && !isPlaceholderLocationName(name) && !isDayOrCityLabelOnly(name)) {
    return name;
  }
  return null;
}

export type ItineraryStopPlace = {
  placeName: string;
  city: string | null;
  mapUrl: string | null;
  placesBankId: string | null;
};

/** Walk itinerary days_data and collect real stations (place + city + maps). */
export function collectItineraryStopsFromDaysData(daysData: unknown): ItineraryStopPlace[] {
  const stops: ItineraryStopPlace[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, inheritedCity: string | null) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inheritedCity);
      return;
    }
    if (typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    const dayCity = String(obj.city ?? '').trim() || inheritedCity || null;
    const place = pickStopPlaceName(obj);
    const mapUrl = pickMapsUrlFromObject(obj);
    const placesBankId = String(obj.places_bank_id ?? obj.place_id ?? '').trim() || null;

    if (place) {
      const key = `${place.toLowerCase()}|${(dayCity || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        stops.push({
          placeName: place,
          city: dayCity && !isPlaceholderLocationName(dayCity) ? dayCity : null,
          mapUrl,
          placesBankId,
        });
      }
    }

    for (const value of Object.values(obj)) walk(value, dayCity);
  };

  walk(daysData, null);
  return stops;
}

/** Build place-name → maps URL index from itinerary days_data / nested stops. */
export function collectPlaceMapsUrlsFromDaysData(daysData: unknown): Map<string, string> {
  const index = new Map<string, string>();
  for (const stop of collectItineraryStopsFromDaysData(daysData)) {
    if (stop.mapUrl) {
      const key = stop.placeName.trim().toLowerCase();
      if (key && !index.has(key)) index.set(key, stop.mapUrl);
    }
  }
  return index;
}

export function lookupPlaceMapsUrl(
  index: Map<string, string>,
  placeName: string | null | undefined,
): string | null {
  const place = String(placeName ?? '').trim();
  if (!place || isPlaceholderLocationName(place) || isDayOrCityLabelOnly(place)) {
    return null;
  }

  const exact = index.get(place.toLowerCase());
  if (exact) return exact;

  const lower = place.toLowerCase();
  for (const [key, url] of index) {
    if (key.includes(lower) || lower.includes(key)) return url;
  }
  return null;
}

export function matchStopForMemory(
  memory: Pick<ClientMemory, 'locationName' | 'location' | 'title' | 'caption' | 'mapUrl'>,
  stops: ItineraryStopPlace[],
): ItineraryStopPlace | null {
  const realStops = stops.filter(
    (s) =>
      s.placeName &&
      !isPlaceholderLocationName(s.placeName) &&
      !isDayOrCityLabelOnly(s.placeName, s.city),
  );
  if (!realStops.length) return null;

  const candidates = [
    memory.locationName,
    memory.location,
    memory.title,
    memory.caption,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(
      (v) => v && !isPlaceholderLocationName(v) && !isDayOrCityLabelOnly(v),
    );

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const exact = realStops.find((s) => s.placeName.toLowerCase() === lower);
    if (exact) return exact;
    const fuzzy = realStops.find(
      (s) =>
        s.placeName.toLowerCase().includes(lower) ||
        lower.includes(s.placeName.toLowerCase()),
    );
    if (fuzzy) return fuzzy;
  }

  if (isRealGoogleMapsUrl(memory.mapUrl)) {
    const byMap = realStops.find((s) => s.mapUrl && s.mapUrl === memory.mapUrl);
    if (byMap) return byMap;
  }

  // Placeholder memory on a trip with stations — use the first real landmark
  return realStops[0] ?? null;
}

/**
 * Google Maps search for an exact landmark (place + city).
 * Never builds a query from placeholders / day titles / city-only labels.
 */
export function buildExactPlaceSearchMapsUrl(
  placeName: string | null | undefined,
  cityName?: string | null,
): string | null {
  const place = String(placeName ?? '').trim();
  if (
    !place ||
    place === 'مكان غير محدد' ||
    isPlaceholderLocationName(place) ||
    isDayOrCityLabelOnly(place, cityName)
  ) {
    return null;
  }

  const city = String(cityName ?? '').trim();
  const query =
    city &&
    city !== place &&
    !isPlaceholderLocationName(city) &&
    !isDayOrCityLabelOnly(city)
      ? `${place} ${city}`
      : place;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Prefer an explicit DB / itinerary map URL.
 * Optional fallback: search for exact place + city (never city-only / placeholders).
 */
export function resolveMemoryGoogleMapsUrl(
  memory: Pick<
    ClientMemory,
    | 'mapUrl'
    | 'locationName'
    | 'location'
    | 'title'
    | 'caption'
    | 'destination'
    | 'stationName'
    | 'city'
  >,
  placeMapsIndex?: Map<string, string> | null,
  options?: { placeName?: string | null; cityName?: string | null; allowSearchFallback?: boolean },
): string | null {
  if (isRealGoogleMapsUrl(memory.mapUrl)) {
    return String(memory.mapUrl).trim();
  }

  const candidates = [
    options?.placeName,
    memory.stationName,
    memory.locationName,
    memory.location,
    memory.title,
    memory.caption,
  ];

  if (placeMapsIndex && placeMapsIndex.size > 0) {
    for (const candidate of candidates) {
      const found = lookupPlaceMapsUrl(placeMapsIndex, candidate);
      if (found) return found;
    }
  }

  if (options?.allowSearchFallback === false) return null;

  const place =
    String(options?.placeName ?? '').trim() ||
    candidates.map((c) => String(c ?? '').trim()).find(
      (t) =>
        t &&
        t !== 'مكان غير محدد' &&
        !isPlaceholderLocationName(t) &&
        !isDayOrCityLabelOnly(t, options?.cityName || memory.city),
    ) ||
    null;

  const city =
    String(options?.cityName ?? '').trim() ||
    memory.city?.trim() ||
    memory.destination?.trim() ||
    null;

  return buildExactPlaceSearchMapsUrl(place, city);
}
