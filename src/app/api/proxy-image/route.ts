import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_HOST_SUFFIXES = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'unsplash.com',
  'supabase.co',
  'storage.googleapis.com',
  'cloudinary.com',
  'res.cloudinary.com',
  'wanderloom-travel.vercel.app',
];

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
    return true;
  }
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  // Basic IPv4 private ranges
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) {
    return true;
  }
  return false;
}

function isAllowedRemoteUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (isPrivateHostname(parsed.hostname)) return null;

  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  // Allow any https host that looks like a CDN image URL if query has image-ish path,
  // but prefer allowlist — keep allowlist strict for SSRF safety.
  if (!allowed) {
    // Soft allow: common image CDNs / photo IDs in path
    if (!/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(parsed.pathname) && !host.includes('unsplash')) {
      return null;
    }
  }
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = (searchParams.get('url') ?? '').trim();

  if (!imageUrl) {
    return new NextResponse('Missing URL', { status: 400 });
  }

  const parsed = isAllowedRemoteUrl(imageUrl);
  if (!parsed) {
    return new NextResponse('URL not allowed', { status: 400 });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'WanderloomImageProxy/1.0',
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return new NextResponse(`Upstream ${response.status}`, { status: 502 });
    }

    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0]!;
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[proxy-image]', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
