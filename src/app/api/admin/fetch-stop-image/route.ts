import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import {
  buildStopImageSearchQuery,
  curateStopImage,
  stopImageCuratorConfigured,
} from '@/lib/stop-image-curator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fetch-stop-image
 * Body: { query?, title?, search_keyword?, category?, city?, destination? }
 * Returns a luxury landscape image URL (Unsplash → Google Places fallback).
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const query = buildStopImageSearchQuery({
    query: String(body.query ?? '').trim(),
    title: String(body.title ?? body.name ?? body.place_name ?? '').trim(),
    searchKeyword: String(body.search_keyword ?? body.searchKeyword ?? body.keyword ?? '').trim(),
    category: String(body.category ?? '').trim(),
    city: String(body.city ?? '').trim(),
    destination: String(body.destination ?? '').trim(),
  });

  if (!query) {
    return NextResponse.json(
      { ok: false, error: 'query_required', message: 'أدخل عنوان المحطة أو كلمة بحث.' },
      { status: 400 },
    );
  }

  const configured = stopImageCuratorConfigured();
  if (!configured.unsplash && !configured.google) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_api_key',
        message:
          'أضف UNSPLASH_ACCESS_KEY (مفضّل) أو فعّل مفتاح Google Places لجلب الصور تلقائياً.',
      },
      { status: 503 },
    );
  }

  try {
    const curated = await curateStopImage(query);
    if (!curated?.imageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_image',
          message: 'لم يُعثر على صورة مناسبة لهذا البحث.',
          query,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      imageUrl: curated.imageUrl,
      source: curated.source,
      query: curated.query,
      photographer: curated.photographer ?? null,
      attribution: curated.attribution ?? null,
    });
  } catch (error) {
    console.error('[fetch-stop-image]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'curator_failed',
        message: error instanceof Error ? error.message : 'فشل جلب الصورة',
      },
      { status: 500 },
    );
  }
}
