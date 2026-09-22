import { NextRequest, NextResponse } from 'next/server';

import { AI_CONCIERGE_SOURCE, trimText } from '@/lib/ai-concierge';
import { findOrCreateConciergeClient, syncClientLeadSource } from '@/lib/ai-concierge-clients';
import {
  buildVerificationToken,
  createAndStoreOtp,
  consumeOtp,
  normalizeConciergePhone,
} from '@/lib/ai-concierge-otp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-send-server';

export const runtime = 'nodejs';

type OtpBody = {
  action?: 'send' | 'verify';
  clientName?: string;
  userPhone?: string;
  code?: string;
};

export async function POST(req: NextRequest) {
  let body: OtpBody;
  try {
    body = (await req.json()) as OtpBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 });
  }

  const action = body.action === 'verify' ? 'verify' : 'send';
  const clientName = trimText(body.clientName, 120);
  const userPhone = trimText(body.userPhone, 40);

  if (action === 'send') {
    if (!clientName) {
      return NextResponse.json({ ok: false, error: 'يرجى إدخال الاسم الكريم' }, { status: 400 });
    }
    const phoneNorm = normalizeConciergePhone(userPhone);
    if (!phoneNorm.ok) {
      return NextResponse.json({ ok: false, error: phoneNorm.error }, { status: 400 });
    }

    const stored = await createAndStoreOtp({ phone: phoneNorm.phone, clientName });
    if (!stored.ok) {
      return NextResponse.json({ ok: false, error: stored.error }, { status: 429 });
    }

    const message = [
      `مرحباً ${clientName}،`,
      `رمز التحقق لـ مستشار واندرلوم: ${stored.code}`,
      'صالح لمدة 10 دقائق. لا تشاركه مع أحد.',
    ].join('\n');

    const sent = await sendWhatsAppMessage({
      phone: phoneNorm.phone,
      name: clientName,
      message,
    });

    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: sent.error || 'تعذّر إرسال رمز التحقق عبر واتساب' },
        { status: 502 },
      );
    }

    const exposeDevCode =
      sent.simulated === true ||
      process.env.NODE_ENV !== 'production' ||
      (process.env.AI_CONCIERGE_OTP_DEV_CODE ?? '').trim() === '1';

    return NextResponse.json({
      ok: true,
      action: 'send',
      phone: phoneNorm.phone,
      expiresInSec: stored.expiresInSec,
      simulated: Boolean(sent.simulated),
      ...(exposeDevCode ? { devCode: stored.code } : {}),
      message: sent.simulated
        ? 'تم إنشاء الرمز (وضع تجريبي). أدخل الرمز الظاهر للمتابعة.'
        : 'تم إرسال رمز التحقق إلى واتسابك.',
    });
  }

  // verify
  if (!userPhone) {
    return NextResponse.json({ ok: false, error: 'رقم الجوال مطلوب' }, { status: 400 });
  }

  const consumed = await consumeOtp({ phone: userPhone, code: String(body.code ?? '') });
  if (!consumed.ok) {
    return NextResponse.json({ ok: false, error: consumed.error }, { status: 400 });
  }

  const name = clientName || consumed.clientName;
  let clientId: number | null = null;

  try {
    const admin = createSupabaseAdminClient();
    const linked = await findOrCreateConciergeClient(admin, {
      name,
      phone: consumed.phone,
    });
    if (linked?.id) {
      clientId = linked.id;
      await syncClientLeadSource(admin, linked.id);
    }
  } catch (err) {
    console.error('[ai-concierge-otp] client link failed:', err);
  }

  const verificationToken = buildVerificationToken({
    phone: consumed.phone,
    name,
    clientId,
  });

  return NextResponse.json({
    ok: true,
    action: 'verify',
    isVerified: true,
    verificationToken,
    clientId,
    clientName: name,
    userPhone: consumed.phone,
    leadSource: AI_CONCIERGE_SOURCE,
  });
}
