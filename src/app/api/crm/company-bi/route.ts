import { NextResponse, type NextRequest } from 'next/server';

import { loadCompanyFacts } from '@/lib/company-bi-server';
import { hasCrmPermission } from '@/lib/crm-permissions';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/crm/company-bi — normalized company facts for «التقارير المالية» and «لوحة الشركة». */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_payments')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  try {
    const facts = await loadCompanyFacts();
    return NextResponse.json({ ok: true, facts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[api/crm/company-bi]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
