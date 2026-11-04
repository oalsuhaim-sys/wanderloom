import { NextResponse, type NextRequest } from 'next/server';

import { loadTailorPlanByToken, toPublicPlan } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/tailor-now/[token] — the public view of a plan (only the days the visitor may see). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const row = await loadTailorPlanByToken(token);
    if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, plan: toPublicPlan(row) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[api/tailor-now/[token]] load failed:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
