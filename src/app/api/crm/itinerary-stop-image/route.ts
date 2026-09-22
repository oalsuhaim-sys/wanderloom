import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Preferred public image buckets (first match wins). */
const BUCKET_CANDIDATES = [
  'itinerary-images',
  'public-media',
  'attachments',
  'itinerary-assets',
] as const;

const PRIMARY_BUCKET = BUCKET_CANDIDATES[0];
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
}

function isBucketMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('bucket not found') || m.includes('not found') || m.includes('does not exist');
}

async function ensurePublicBucket(admin: SupabaseClient, bucket: string): Promise<void> {
  const { error } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  });
  if (!error) return;
  const msg = (error.message || '').toLowerCase();
  // Already exists is fine
  if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('409')) {
    return;
  }
  console.warn('[itinerary-stop-image] createBucket warning:', bucket, error.message);
}

async function uploadToBucket(
  admin: SupabaseClient,
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string; missing: boolean }> {
  const { error: uploadError } = await admin.storage.from(bucket).upload(filePath, buffer, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    const message = uploadError.message || 'upload_failed';
    return { ok: false, error: message, missing: isBucketMissingError(message) };
  }

  const { data: publicData } = admin.storage.from(bucket).getPublicUrl(filePath);
  const publicUrl = publicData.publicUrl;
  if (!publicUrl) {
    return { ok: false, error: 'missing_public_url', missing: false };
  }
  return { ok: true, publicUrl };
}

/**
 * POST multipart: file (+ optional placeName, itineraryId)
 * Tries itinerary-images → public-media → attachments → itinerary-assets.
 * Creates itinerary-images via admin API when missing.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 413 });
  }

  const mime = (file.type || 'image/jpeg').toLowerCase();
  if (!ALLOWED_TYPES.has(mime) && !mime.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: 'invalid_mime' }, { status: 415 });
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (configErr) {
    console.error('[itinerary-stop-image] admin unavailable:', configErr);
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const itineraryId = String(formData.get('itineraryId') ?? 'stops').trim() || 'stops';
  const safeFolder = itineraryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'stops';
  const filePath = `stops/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = mime || 'image/jpeg';

  // Ensure preferred bucket exists (service role can create it)
  await ensurePublicBucket(admin, PRIMARY_BUCKET);

  let lastError = 'upload_failed';
  for (const bucket of BUCKET_CANDIDATES) {
    let result = await uploadToBucket(admin, bucket, filePath, buffer, contentType);

    if (!result.ok && result.missing && bucket === PRIMARY_BUCKET) {
      await ensurePublicBucket(admin, bucket);
      result = await uploadToBucket(admin, bucket, filePath, buffer, contentType);
    }

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        publicUrl: result.publicUrl,
        path: filePath,
        bucket,
      });
    }

    lastError = result.error;
    if (!result.missing) {
      // Permission / mime / other hard failure on this bucket — try next anyway
      console.warn('[itinerary-stop-image] bucket failed, trying next:', bucket, result.error);
    } else {
      console.warn('[itinerary-stop-image] bucket missing, trying next:', bucket);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: lastError,
      hint: 'يمكنك لصق رابط صورة مباشرة (https://…) في الحقل دون رفع.',
      bucketsTried: [...BUCKET_CANDIDATES],
    },
    { status: 500 },
  );
}
