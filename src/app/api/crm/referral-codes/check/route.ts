import { NextResponse } from 'next/server';

import { findReferralCodeOwner, normalizeReferralLookupCode } from '@/lib/referral-code-owner';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const code = normalizeReferralLookupCode(
    new URL(request.url).searchParams.get('code') ?? '',
  );

  if (!code) {
    return NextResponse.json({ ok: true, available: true, duplicate: false });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const owner = await findReferralCodeOwner(admin, code);
  return NextResponse.json({
    ok: true,
    available: !owner,
    duplicate: Boolean(owner),
  });
}
