import { NextResponse } from 'next/server';

import { insertInterestLeadAdmin } from '@/lib/interest-lead-insert';
import { canonicalizePhoneWa } from '@/lib/client-intake-pipeline';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      full_name?: string;
      phone_wa?: string;
      destination?: string;
    };

    const fullName = String(body.full_name ?? '').trim();
    const phoneRaw = String(body.phone_wa ?? '').trim();
    const destination = String(body.destination ?? '').trim();
    const phoneWa = canonicalizePhoneWa(phoneRaw);
    const digits = phoneWa.replace(/\D/g, '');

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ success: false, error: 'يرجى إدخال الاسم الكامل' }, { status: 400 });
    }
    if (digits.length < 8) {
      return NextResponse.json({ success: false, error: 'يرجى إدخال رقم واتساب صالح' }, { status: 400 });
    }

    const result = await insertInterestLeadAdmin({ fullName, phoneWa, destination });

    if (!result.ok) {
      console.error('[api/register-interest]', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      message: 'تم تسجيل اهتمامك بنجاح!',
    });
  } catch (err) {
    console.error('[api/register-interest] unexpected:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
