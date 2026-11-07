import { NextResponse, type NextRequest } from 'next/server';

import { EXPENSE_CATEGORIES } from '@/lib/company-bi';
import { hasCrmPermission } from '@/lib/crm-permissions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/crm/expenses — add an operating expense. */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_payments')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const amount = Number(String(body.amount ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: 'amount_invalid' }, { status: 400 });
  const date = String(body.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: 'date_invalid' }, { status: 400 });
  const categoryRaw = String(body.category ?? '').trim();
  const category = categoryRaw in EXPENSE_CATEGORIES ? categoryRaw : 'other';

  const { data, error } = await createSupabaseAdminClient()
    .from('operating_expenses')
    .insert({
      expense_date: date,
      category,
      description: String(body.description ?? '').trim().slice(0, 300) || null,
      amount: Math.round(amount * 100) / 100,
      destination: String(body.destination ?? '').trim().slice(0, 80) || null,
      created_by: auth.user.id ?? null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[api/crm/expenses] insert failed:', error.message);
    const missing = /does not exist|schema cache|could not find/i.test(error.message);
    return NextResponse.json({ ok: false, error: missing ? 'table_missing' : 'server_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
