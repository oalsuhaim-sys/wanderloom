import { NextResponse, type NextRequest } from 'next/server';

import { hasCrmPermission } from '@/lib/crm-permissions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/crm/expenses/[id] — remove an operating expense entered by mistake. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_payments')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const { error } = await createSupabaseAdminClient().from('operating_expenses').delete().eq('id', id);
  if (error) {
    console.error('[api/crm/expenses] delete failed:', error.message);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
