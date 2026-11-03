import { NextResponse, type NextRequest } from 'next/server';

import { fetchClientFollowups } from '@/lib/client-followups';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export { POST } from '../../crm/client-followups/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/followups?clientId=
 * يجلب متابعات العميل من Supabase بنفس معرف صفحة البروفايل.
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!('user' in auth) || !auth.user) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
  }

  const clientId =
    request.nextUrl.searchParams.get('clientId') ||
    request.nextUrl.searchParams.get('client_id') ||
    '';

  if (!clientId.trim() || clientId.trim() === 'undefined' || clientId.trim() === 'null') {
    return NextResponse.json({ ok: false, error: 'معرّف العميل غير صالح.' }, { status: 400 });
  }

  try {
    let clientDb;
    try {
      clientDb = createSupabaseAdminClient();
    } catch {
      clientDb = auth.supabase;
    }

    const followups = await fetchClientFollowups(clientDb, clientId.trim(), { limit: 40 });
    return NextResponse.json({ ok: true, followups });
  } catch {
    return NextResponse.json({ ok: true, followups: [] });
  }
}
