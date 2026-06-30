import { NextResponse } from 'next/server';

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT?.trim() ||
  'WanderloomItineraryBuilder/1.0 (https://wanderloom.app)';

const serverCache = new Map<string, { lat: number; lng: number }>();
let lastRequestAt = 0;

async function nominatimSearch(q: string): Promise<{ lat: number; lng: number } | null> {
  const cached = serverCache.get(q.toLowerCase());
  if (cached) return cached;

  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const hit = rows[0];
  if (!hit?.lat || !hit.lon) return null;

  const lat = Number.parseFloat(hit.lat);
  const lng = Number.parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const result = { lat, lng };
  serverCache.set(q.toLowerCase(), result);
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'missing q' }, { status: 400 });
  }

  try {
    const coords = await nominatimSearch(q);
    if (!coords) {
      return NextResponse.json({ error: 'ZERO_RESULTS' }, { status: 404 });
    }
    return NextResponse.json(coords);
  } catch {
    return NextResponse.json({ error: 'geocode failed' }, { status: 502 });
  }
}
