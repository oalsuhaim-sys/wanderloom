import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

function jsonWithCookies(
  body: unknown,
  status: number,
  getResponse: () => NextResponse,
) {
  const response = NextResponse.json(body, { status });
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

function isTripId(value: string): boolean {
  return /^\d+$/.test(value);
}

function parseOptionalImageUrl(raw: unknown): string | null | undefined {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status ?? 403,
      auth.getResponse,
    );
  }

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() ?? '';
  if (!isTripId(tripId)) {
    return jsonWithCookies(
      { ok: false, error: 'trip_id غير صالح.' },
      400,
      auth.getResponse,
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'server_config' },
      503,
      auth.getResponse,
    );
  }

  const { data, error } = await admin
    .from('trip_logs')
    .select('id, trip_id, leader_id, log_text, image_url, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonWithCookies(
      { ok: false, error: error.message },
      500,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    { ok: true, logs: data ?? [] },
    200,
    auth.getResponse,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status ?? 403,
      auth.getResponse,
    );
  }

  let body: {
    trip_id?: string | number;
    leader_id?: string;
    log_text?: string;
    image_url?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'invalid_body' },
      400,
      auth.getResponse,
    );
  }

  const tripId = String(body.trip_id ?? '').trim();
  const leaderId = String(body.leader_id ?? '').trim();
  const logText = String(body.log_text ?? '').trim();
  const imageUrl = parseOptionalImageUrl(body.image_url);

  if (!isTripId(tripId) || !leaderId || !logText) {
    return jsonWithCookies(
      { ok: false, error: 'بيانات الرحلة والقائد ونص التحديث مطلوبة.' },
      400,
      auth.getResponse,
    );
  }
  if (logText.length > 5_000) {
    return jsonWithCookies(
      { ok: false, error: 'نص التحديث يتجاوز 5000 حرف.' },
      400,
      auth.getResponse,
    );
  }
  if (imageUrl === undefined) {
    return jsonWithCookies(
      { ok: false, error: 'رابط الصورة يجب أن يبدأ بـ http أو https.' },
      400,
      auth.getResponse,
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'server_config' },
      503,
      auth.getResponse,
    );
  }

  const [tripResult, leaderResult] = await Promise.all([
    admin.from('itineraries').select('id').eq('id', tripId).maybeSingle(),
    admin.from('leaders').select('id').eq('id', leaderId).maybeSingle(),
  ]);
  if (tripResult.error || leaderResult.error) {
    return jsonWithCookies(
      {
        ok: false,
        error: tripResult.error?.message || leaderResult.error?.message,
      },
      500,
      auth.getResponse,
    );
  }
  if (!tripResult.data || !leaderResult.data) {
    return jsonWithCookies(
      {
        ok: false,
        error: !tripResult.data ? 'الرحلة غير موجودة.' : 'القائد غير موجود.',
      },
      404,
      auth.getResponse,
    );
  }

  const { data, error } = await admin
    .from('trip_logs')
    .insert({
      trip_id: tripId,
      leader_id: leaderId,
      log_text: logText,
      image_url: imageUrl,
    })
    .select('id, trip_id, leader_id, log_text, image_url, created_at')
    .single();

  if (error) {
    return jsonWithCookies(
      { ok: false, error: error.message },
      500,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    { ok: true, log: data },
    201,
    auth.getResponse,
  );
}
