import { NextResponse, type NextRequest } from 'next/server';

import { hasCrmPermission } from '@/lib/crm-permissions';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { confirmTailorPayment, TailorError } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/crm/tailor-now/[id]/confirm — staff confirm the bank transfer; the remaining days unlock. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_payments')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });

  try {
    const plan = await confirmTailorPayment(id, auth.user.id ?? null);
    return NextResponse.json({ ok: true, token: plan.access_token, status: plan.status });
  } catch (err) {
    if (err instanceof TailorError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error('[api/crm/tailor-now/confirm] failed:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
