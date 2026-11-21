/**
 * Coordinates of a places-bank row: its own lat/lng columns, or the position inside its map link
 * (Google «@lat,lng» / «!3dlat!4dlng» / «q=lat,lng» · Naver / Kakao «lat=…&lng=…»). Pure.
 */

export type LatLng = [number, number];

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function valid(lat: number | null, lng: number | null): LatLng | null {
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

export function coordsFromUrl(url: unknown): LatLng | null {
  const u = String(url ?? '');
  if (!u) return null;
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // exact place position in Google links
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|center|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(u);
    if (m) {
      const c = valid(Number(m[1]), Number(m[2]));
      if (c) return c;
    }
  }
  const lat = /[?&](?:lat|latitude|y)=(-?\d{1,2}\.\d+)/i.exec(u);
  const lng = /[?&](?:lng|lon|longitude|x)=(-?\d{1,3}\.\d+)/i.exec(u);
  return lat && lng ? valid(Number(lat[1]), Number(lng[1])) : null;
}

export function mapLinksOf(row: Record<string, unknown>): string[] {
  return ['map_url', 'maps_url', 'google_maps_url', 'naver_url', 'url'].map((k) => String(row[k] ?? '').trim()).filter((u) => /^https?:\/\//i.test(u));
}

export function coordsFromRow(row: Record<string, unknown>): LatLng | null {
  const own = valid(num(row.lat ?? row.latitude), num(row.lng ?? row.longitude));
  if (own) return own;
  for (const link of mapLinksOf(row)) {
    const c = coordsFromUrl(link);
    if (c) return c;
  }
  return null;
}
