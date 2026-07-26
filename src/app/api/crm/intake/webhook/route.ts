import { NextResponse } from 'next/server';

import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type WebhookBody = {
  lead_id?: string;
  quotation_id?: string;
};

/**
 * POST /api/crm/intake/webhook
 * أتمتة DNA تُفعَّل عند قبول عرض السعر من CRM — وليس عند إنشاء الطلب.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WebhookBody;
    const leadId = String(body.lead_id ?? '').trim();
    const quotationId = String(body.quotation_id ?? '').trim();

    if (!leadId && !quotationId) {
      return NextResponse.json({ ok: false, error: 'lead_id أو quotation_id مطلوب' }, { status: 400 });
    }

    void createServerSupabase();

    return NextResponse.json(
      {
        ok: false,
        error:
          'أتمتة DNA أصبحت مرتبطة بقبول عرض السعر. اعتمد العرض من /crm/quotations لفتح رسالة واتساب الجاهزة.',
      },
      { status: 410 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل تشغيل الأتمتة';
    console.error('[intake/webhook]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
