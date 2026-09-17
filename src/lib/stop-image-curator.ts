/** Luxury stop image curation — Unsplash primary, Google Places Photos fallback */

export type CuratedStopImage = {
  imageUrl: string;
  source: 'unsplash' | 'google_places';
  query: string;
  photographer?: string;
  attribution?: string;
};

const CATEGORY_LUXURY_HINTS: Record<string, string> = {
  h: 'luxury hotel suite interior morning light',
  c: 'specialty coffee cafe interior luxury',
  r: 'gourmet fine dining restaurant interior',
  s: 'boutique shopping street elegant',
  l: 'quiet hidden landmark scenic travel',
  d: 'exclusive private experience luxury travel',
  f: 'family luxury leisure destination',
  o: 'luxury travel aesthetic landscape',
};

export function buildStopImageSearchQuery(input: {
  query?: string;
  title?: string;
  searchKeyword?: string;
  category?: string;
  city?: string;
  destination?: string;
}): string {
  const parts = [
    String(input.query ?? '').trim(),
    String(input.searchKeyword ?? '').trim(),
    String(input.title ?? '').trim(),
    String(input.city ?? '').trim(),
    String(input.destination ?? '').trim(),
    CATEGORY_LUXURY_HINTS[String(input.category ?? '').trim().toLowerCase()] ??
      'luxury travel photography',
  ].filter(Boolean);

  // Prefer English keyword + place + luxury vibe; dedupe while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.slice(0, 4).join(' ').trim() || 'luxury travel destination';
}

function unsplashAccessKey(): string {
  return (
    (process.env.UNSPLASH_ACCESS_KEY ?? '').trim() ||
    (process.env.UNSPLASH_API_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? '').trim()
  );
}

function googlePlacesKey(): string {
  return (
    (process.env.GOOGLE_PLACES_API_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim()
  );
}

async function fetchFromUnsplash(query: string): Promise<CuratedStopImage | null> {
  const key = unsplashAccessKey();
  if (!key) return null;

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('per_page', '1');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[stop-image-curator] unsplash failed:', res.status, body.slice(0, 200));
    return null;
  }

  const json = (await res.json()) as {
    results?: Array<{
      urls?: { regular?: string; full?: string; raw?: string };
      user?: { name?: string; links?: { html?: string } };
      links?: { html?: string };
    }>;
  };

  const hit = json.results?.[0];
  const imageUrl = String(hit?.urls?.regular ?? hit?.urls?.full ?? hit?.urls?.raw ?? '').trim();
  if (!imageUrl) return null;

  const photographer = String(hit?.user?.name ?? '').trim();
  return {
    imageUrl,
    source: 'unsplash',
    query,
    photographer: photographer || undefined,
    attribution: photographer
      ? `Photo by ${photographer} on Unsplash`
      : 'Photo from Unsplash',
  };
}

async function fetchFromGooglePlaces(query: string): Promise<CuratedStopImage | null> {
  const key = googlePlacesKey();
  if (!key) return null;

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findUrl.searchParams.set('input', query);
  findUrl.searchParams.set('inputtype', 'textquery');
  findUrl.searchParams.set('fields', 'photos,name,place_id');
  findUrl.searchParams.set('key', key);

  const findRes = await fetch(findUrl.toString(), { next: { revalidate: 0 } });
  if (!findRes.ok) {
    console.warn('[stop-image-curator] google findplace HTTP', findRes.status);
    return null;
  }

  const findJson = (await findRes.json()) as {
    candidates?: Array<{
      photos?: Array<{ photo_reference?: string }>;
      name?: string;
    }>;
    status?: string;
  };

  const photoRef = String(findJson.candidates?.[0]?.photos?.[0]?.photo_reference ?? '').trim();
  if (!photoRef) {
    console.warn('[stop-image-curator] google no photo:', findJson.status);
    return null;
  }

  const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
  photoUrl.searchParams.set('maxwidth', '1600');
  photoUrl.searchParams.set('photo_reference', photoRef);
  photoUrl.searchParams.set('key', key);

  return {
    imageUrl: photoUrl.toString(),
    source: 'google_places',
    query,
    attribution: 'Photo from Google Places',
  };
}

/**
 * Curate one luxury landscape image for a stop query.
 * Prefers Unsplash; falls back to Google Places Photos when configured.
 */
export async function curateStopImage(rawQuery: string): Promise<CuratedStopImage | null> {
  const query = String(rawQuery ?? '').trim();
  if (!query) return null;

  try {
    const unsplash = await fetchFromUnsplash(query);
    if (unsplash) return unsplash;
  } catch (err) {
    console.warn('[stop-image-curator] unsplash error:', err);
  }

  try {
    const google = await fetchFromGooglePlaces(query);
    if (google) return google;
  } catch (err) {
    console.warn('[stop-image-curator] google error:', err);
  }

  return null;
}

export function stopImageCuratorConfigured(): {
  unsplash: boolean;
  google: boolean;
} {
  return {
    unsplash: Boolean(unsplashAccessKey()),
    google: Boolean(googlePlacesKey()),
  };
}

/** Run async map with a concurrency cap (Unsplash rate limits). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await worker(items[i]!, i);
    }
  }

  const pool = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () =>
    runWorker(),
  );
  await Promise.all(pool);
  return results;
}
