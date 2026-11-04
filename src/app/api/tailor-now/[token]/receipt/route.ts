import { NextResponse, type NextRequest } from 'next/server';

import { submitTailorReceipt, TailorError } from '@/lib/tailor-now-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/tailor-now/[token]/receipt { receiptUrl } — the transfer receipt was uploaded to storage. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let receiptUrl = '';
  try {
    const body = (await request.json()) as { receiptUrl?: string };
    receiptUrl = String(body.receiptUrl ?? '');
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  try {
    const plan = await submitTailorReceipt(token, receiptUrl);
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    if (err instanceof TailorError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
    }
    console.error('[api/tailor-now/receipt] failed:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
