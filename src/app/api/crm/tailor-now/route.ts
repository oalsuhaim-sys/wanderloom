import { NextResponse, type NextRequest } from 'next/server';

import { hasCrmPermission } from '@/lib/crm-permissions';
import { getAuthenticatedCrmUser } from '@/lib/supabase/route-handler';
import { listTailorPlansForCrm, planSegments } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/crm/tailor-now — staff list of «فصّل الآن» plans. */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedCrmUser(request);
  if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!hasCrmPermission(auth.access, 'can_access_payments')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const rows = await listTailorPlansForCrm();
    const plans = rows.map((r) => {
      const days = Array.isArray(r.days) ? r.days.length : 0;
      const usage = (r.ai_usage ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        token: r.access_token,
        createdAt: r.created_at,
        locale: r.locale,
        fullName: r.full_name,
        phoneWa: r.phone_wa,
        email: r.email,
        country: r.country_label ?? r.country_id,
        segments: planSegments(r),
        startDate: r.start_date,
        daysTotal: r.days_total,
        daysBuilt: days,
        totalPrice: Number(r.total_price),
        status: r.status,
        receiptUrl: r.receipt_url,
        paidAt: r.paid_at,
        leadId: r.lead_id,
        lastError: r.last_error,
        costUsd: Number(usage.cost_usd) || 0,
        calls: Number(usage.calls) || 0,
      };
    });
    return NextResponse.json({ ok: true, plans }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[api/crm/tailor-now] list failed:', err);
    const missing = /tailor_plans|does not exist|schema cache/i.test(String((err as { message?: string })?.message ?? err));
    return NextResponse.json({ ok: false, error: missing ? 'table_missing' : 'server_error' }, { status: 500 });
  }
}
