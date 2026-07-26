import { NextResponse } from 'next/server'

import { escapeEmailHtml, sendEmailAlert } from '@/lib/emailAlert'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function parseLanguages(raw: string): string[] {
  return raw
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const partnerType = String(
    body.type ?? body.partnerType ?? body.partner_type ?? body.partner_kind ?? '',
  )
    .trim()
    .toLowerCase()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const languages = String(body.languages ?? '').trim()
  const destinations = String(body.destinations ?? '').trim()
  const specialtyRegions = String(
    body.specialtyRegions ?? body.specialty_regions ?? '',
  ).trim()
  const experienceRaw = String(body.experienceYears ?? body.experience_years ?? '').trim()
  const experienceYears = experienceRaw
    ? Math.max(0, Math.floor(Number(experienceRaw)))
    : null

  if (partnerType !== 'leader' && partnerType !== 'expert') {
    return NextResponse.json({ ok: false, error: 'نوع الشراكة غير صالح.' }, { status: 400 })
  }
  if (!name || !phone || !email) {
    return NextResponse.json(
      { ok: false, error: 'الاسم والبريد ورقم الجوال مطلوبة.' },
      { status: 400 },
    )
  }
  if (partnerType === 'leader') {
    if (!languages || experienceYears == null || !Number.isFinite(experienceYears)) {
      return NextResponse.json(
        { ok: false, error: 'اللغات وسنوات الخبرة مطلوبة للقادة.' },
        { status: 400 },
      )
    }
  }
  // الوجهة اختيارية في النموذج — تُستمد من رابط الدعوة إن وُجدت.
  const resolvedSpecialty = specialtyRegions || destinations || null

  let admin
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
  }

  if (partnerType === 'leader') {
    const { error } = await admin.from('leaders').insert({
      name,
      email,
      phone,
      languages: parseLanguages(languages),
      experience_years: experienceYears,
      destinations: destinations || null,
      status: 'pending',
    })
    if (error) {
      console.error('[partners/apply] leaders insert:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await admin.from('experts').insert({
      name,
      email,
      phone,
      specialty_regions: resolvedSpecialty,
      status: 'pending',
    })
    if (error) {
      console.error('[partners/apply] experts insert:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  }

  const partnerLabel = partnerType === 'leader' ? 'قائد رحلات' : 'خبير وجهات'
  const dashboardUrl = `${String(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wanderloom-travel.vercel.app',
  ).replace(/\/$/, '')}/crm/partners-radar`

  await sendEmailAlert(
    '🚨 طلب انضمام شريك جديد بانتظار الموافقة - Wanderloom',
    `
      <div dir="rtl" style="background:#f7f5ef;padding:32px;font-family:Arial,Tahoma,sans-serif;color:#17251d">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e8dcc0;border-radius:20px;overflow:hidden">
          <div style="background:#10251b;padding:24px 28px;color:#ffffff">
            <div style="color:#c4a464;font-size:12px;font-weight:700;letter-spacing:2px">WANDERLOOM PARTNERS</div>
            <h1 style="margin:10px 0 0;font-size:22px">طلب انضمام شريك جديد</h1>
          </div>
          <div style="padding:28px">
            <p style="margin:0 0 22px;color:#5d665f;line-height:1.8">يوجد طلب جديد بانتظار المراجعة والاعتماد في رادار الشركاء.</p>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
              <tr><td style="padding:12px;border-bottom:1px solid #eee;color:#6b746e">الاسم</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:700">${escapeEmailHtml(name)}</td></tr>
              <tr><td style="padding:12px;border-bottom:1px solid #eee;color:#6b746e">الجوال</td><td dir="ltr" style="padding:12px;border-bottom:1px solid #eee;font-weight:700;text-align:right">${escapeEmailHtml(phone)}</td></tr>
              <tr><td style="padding:12px;color:#6b746e">نوع الشريك</td><td style="padding:12px;font-weight:700">${partnerLabel}</td></tr>
            </table>
            <div style="margin-top:26px;text-align:center">
              <a href="${dashboardUrl}" style="display:inline-block;background:#c4a464;color:#10251b;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:700">فتح رادار الشركاء</a>
            </div>
          </div>
        </div>
      </div>
    `,
  )

  return NextResponse.json({
    ok: true,
    message: 'تم استلام طلبك — سيراجعه فريق وندرلُوم قريباً.',
  })
}
