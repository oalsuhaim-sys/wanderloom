import { NextResponse } from 'next/server';

import { getVapidPublicKey, isWebPushConfigured } from '@/lib/web-push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          'Web Push غير مفعّل — أضف NEXT_PUBLIC_VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في البيئة.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    publicKey: getVapidPublicKey(),
  });
}
