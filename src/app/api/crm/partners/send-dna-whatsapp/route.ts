import { NextRequest, NextResponse } from 'next/server';

import {
  partnerDnaSharePath,
  type PartnerDnaType,
} from '@/lib/partner-dna';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildPartnerDnaWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-send-server';

export const runtime = 'nodejs';

type Body = {
  type?: string;
  id?: string;
  dnaLink?: string;
};

function parseType(raw: string | undefined): PartnerDnaType | null {
  const value = String(raw ?? '').trim();
  if (value === 'leaders' || value === 'experts' || value === 'celebrities') {
    return value;
  }
  if (value === 'leader') return 'leaders';
  if (value === 'expert') return 'experts';
  if (value === 'celebrity') return 'celebrities';
  return null;
}

function tableForType(type: PartnerDnaType): 'leaders' | 'experts' | 'celebrities' {
  return type;
}

function resolveDnaLink(type: PartnerDnaType, id: string, provided?: string): string {
  const fromClient = String(provided ?? '').trim();
  if (fromClient.startsWith('http://') || fromClient.startsWith('https://')) {
    return fromClient;
  }
  const origin = String(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wanderloom-travel.vercel.app',
  ).replace(/\/$/, '');
  return `${origin}${partnerDnaSharePath(type, id)}`;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (auth.access.is_suspended) {
    return NextResponse.json({ ok: false, error: 'الحساب موقوف' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const type = parseType(body.type);
  const id = String(body.id ?? '').trim();
  if (!type || !id) {
    return NextResponse.json(
      { ok: false, error: 'type و id مطلوبان' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { data, error } = await admin
    .from(tableForType(type))
    .select('id, name, phone')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'الشريك غير موجود' }, { status: 404 });
  }

  const name = String((data as { name?: unknown }).name ?? '').trim();
  const phone = String((data as { phone?: unknown }).phone ?? '').trim();
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: 'لا يوجد رقم واتساب محفوظ لهذا الشريك' },
      { status: 400 },
    );
  }

  const dnaLink = resolveDnaLink(type, id, body.dnaLink);
  const message = buildPartnerDnaWhatsAppMessage(name, dnaLink);
  const result = await sendWhatsAppMessage({ phone, name, dnaLink, message });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    simulated: result.simulated ?? false,
    phone,
    name,
  });
}
