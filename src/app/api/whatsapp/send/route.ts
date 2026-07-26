import { NextResponse } from 'next/server';

import {
  buildRegistrationDnaWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-send-server';

export const runtime = 'nodejs';

type Body = {
  phone?: string;
  name?: string;
  dnaLink?: string;
  message?: string;
};

function isAuthorized(req: Request): boolean {
  const secret = (process.env.WHATSAPP_SEND_SECRET ?? '').trim();
  if (!secret) {
    // Allow when no secret is set only in non-production (local/dev)
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const alt = req.headers.get('x-wanderloom-whatsapp-secret')?.trim() ?? '';
  return bearer === secret || alt === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const phone = String(body.phone ?? '').trim();
  const name = String(body.name ?? '').trim();
  const dnaLink = String(body.dnaLink ?? '').trim();
  const message =
    String(body.message ?? '').trim() ||
    (dnaLink ? buildRegistrationDnaWhatsAppMessage(name, dnaLink) : '');

  if (!phone || !message) {
    return NextResponse.json(
      { ok: false, error: 'phone and message (or dnaLink) are required' },
      { status: 400 },
    );
  }

  const result = await sendWhatsAppMessage({ phone, name, dnaLink, message });
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
