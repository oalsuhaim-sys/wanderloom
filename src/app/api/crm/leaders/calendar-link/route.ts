import { NextResponse, type NextRequest } from 'next/server';

import { ensureLeaderCalendarLink } from '@/lib/leader-calendar-portal';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

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

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status ?? 401,
      auth.getResponse,
    );
  }
  if (auth.access.is_suspended) {
    return jsonWithCookies(
      { ok: false, error: 'الحساب موقوف' },
      403,
      auth.getResponse,
    );
  }

  let body: { leader_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'طلب غير صالح.' },
      400,
      auth.getResponse,
    );
  }

  const leaderId = String(body.leader_id ?? '').trim();
  if (!leaderId) {
    return jsonWithCookies(
      { ok: false, error: 'معرّف القائد مطلوب.' },
      400,
      auth.getResponse,
    );
  }

  const origin = request.nextUrl.origin;
  const result = await ensureLeaderCalendarLink(leaderId, origin);
  if (!result.ok) {
    return jsonWithCookies(
      { ok: false, error: result.error },
      400,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    { ok: true, url: result.url },
    200,
    auth.getResponse,
  );
}
