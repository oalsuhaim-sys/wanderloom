import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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
  if (!allowed) {
    if (
      !/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(parsed.pathname) &&
      !host.includes('unsplash')
    ) {
      return null;
    }
  }
  return parsed;
}

function contentTypeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function toDataUrl(contentType: string, buffer: Buffer): string {
  const mime = (contentType || 'image/jpeg').split(';')[0]!.trim() || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/**
 * Server-side image → Base64 data URL.
 * Bypasses browser CORS entirely so html2canvas can export cleanly.
 *
 * GET /api/image-to-base64?url=<encoded remote or /public path>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = (searchParams.get('url') ?? '').trim();

  if (!rawUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  // Already a data URL — pass through
  if (rawUrl.startsWith('data:image/')) {
    return NextResponse.json({ base64: rawUrl });
  }

  try {
    // Local public asset (e.g. /wanderloom.png)
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      const safeRel = path.normalize(rawUrl).replace(/^(\.\.[/\\])+/, '');
      if (safeRel.includes('..')) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      const filePath = path.join(process.cwd(), 'public', safeRel.replace(/^\//, ''));
      const publicRoot = path.join(process.cwd(), 'public');
      if (!filePath.startsWith(publicRoot)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      const buffer = await readFile(filePath);
      if (buffer.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }
      return NextResponse.json({
        base64: toDataUrl(contentTypeFromExt(filePath), buffer),
      });
    }

    const parsed = isAllowedRemoteUrl(rawUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'WanderloomImageToBase64/1.0',
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream ${response.status}` },
        { status: 502 },
      );
    }

    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0]!;
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    const buffer = Buffer.from(arrayBuffer);
    return NextResponse.json({ base64: toDataUrl(contentType, buffer) });
  } catch (error) {
    console.error('[image-to-base64]', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
