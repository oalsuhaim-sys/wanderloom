import { NextResponse } from 'next/server';

import {
  extractItineraryCodeFromPath,
  uploadClientMemory,
} from '@/lib/client-memories';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function slugFromReferer(request: Request): string {
  const referer = request.headers.get('referer') ?? request.headers.get('referrer') ?? '';
  if (!referer) return '';
  try {
    return extractItineraryCodeFromPath(new URL(referer).pathname);
  } catch {
    return '';
  }
}

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

  const locationName = String(formData.get('locationName') ?? '').trim() || 'محطة مختارة';
  const itineraryIdRaw = formData.get('itineraryId');
  const clientIdRaw = formData.get('clientId');
  const itinerarySlugRaw = formData.get('itinerarySlug');
  const itinerarySlug =
    (itinerarySlugRaw != null && String(itinerarySlugRaw).trim() !== ''
      ? String(itinerarySlugRaw).trim()
      : '') || slugFromReferer(request);

  if (
    !itinerarySlug &&
    (itineraryIdRaw == null || String(itineraryIdRaw).trim() === '')
  ) {
    return NextResponse.json({ ok: false, error: 'missing_itinerary_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (configErr) {
    console.error('[upload-memory] admin client unavailable:', configErr);
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const result = await uploadClientMemory(admin, {
    itineraryId:
      itineraryIdRaw != null && String(itineraryIdRaw).trim() !== ''
        ? (itineraryIdRaw as string | number)
        : undefined,
    clientId:
      clientIdRaw != null && String(clientIdRaw).trim() !== ''
        ? (clientIdRaw as string | number)
        : undefined,
    itinerarySlug: itinerarySlug || null,
    locationName,
    file,
    caption: locationName,
  });

  if (!result.ok) {
    console.error('[upload-memory] failed:', result.error, {
      itineraryIdRaw,
      clientIdRaw,
      itinerarySlug,
      diagnostic: result.diagnostic,
    });
    return NextResponse.json(
      { ok: false, error: result.error, diagnostic: result.diagnostic ?? null },
      { status: 500 },
    );
  }

  console.log('[upload-memory] inserted row:', result.inserted);
  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    diagnostic: result.diagnostic ?? null,
  });
}
