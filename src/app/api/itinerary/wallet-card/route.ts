import { NextResponse } from 'next/server';

/**
 * مسار مؤقت لبطاقة المحفظة الرقمية — سيتم استبداله/توسيعه لاحقاً (توقيع Apple / Samsung).
 * الاستعلام: ?provider=apple|samsung&ref=<magic_link_id>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const ref = searchParams.get('ref');

  if (provider !== 'apple' && provider !== 'samsung') {
    return NextResponse.json({ ok: false, error: 'invalid_provider' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    status: 'pending',
    provider,
    ref: ref ?? null,
    message: 'Wallet pass payload will be implemented in the next step.',
  });
}
