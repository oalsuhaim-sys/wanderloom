import { NextResponse, type NextRequest } from 'next/server';

import { upsertCrmPushSubscription } from '@/lib/web-push-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
}

export async function POST(request: NextRequest) {
  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    employeeId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? '').trim();
  const p256dh = String(body.keys?.p256dh ?? '').trim();
  const auth = String(body.keys?.auth ?? '').trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: 'subscription ناقصة' },
      { status: 400, headers: NO_STORE },
    );
  }

  let userId: string | null = null;
  let employeeId: string | null = body.employeeId
    ? String(body.employeeId).trim()
    : null;

  try {
    const token = bearerToken(request);
    const admin = createSupabaseAdminClient();
    if (token) {
      const {
        data: { user },
      } = await admin.auth.getUser(token);
      userId = user?.id ?? null;
    }
    if (!userId) {
      const session = await getAuthenticatedCrmUser(request);
      if (!('error' in session) && session.user?.id) {
        userId = session.user.id;
        if (!employeeId && session.employeeRow?.id != null) {
          employeeId = String(session.employeeRow.id);
        }
      }
    }
  } catch {
    /* optional auth — still store subscription for broadcast */
  }

  const result = await upsertCrmPushSubscription({
    endpoint,
    p256dh,
    auth,
    userId,
    employeeId,
    userAgent: request.headers.get('user-agent'),
  });

  if (!result.ok) {
    const status = result.error.includes('جدول') ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: result.error },
      { status, headers: NO_STORE },
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
