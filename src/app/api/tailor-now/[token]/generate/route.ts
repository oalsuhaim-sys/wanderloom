import { NextResponse, type NextRequest } from 'next/server';

import { generateNextTailorDays, TailorError } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/tailor-now/[token]/generate — builds the next missing day(s) the visitor is entitled to:
 * Day 1 before payment, all days after the transfer is confirmed. Call repeatedly until pendingDays is empty.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const plan = await generateNextTailorDays(token);
    return NextResponse.json({ ok: true, plan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof TailorError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error('[api/tailor-now/generate] failed:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
