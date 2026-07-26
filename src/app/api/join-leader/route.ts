import { NextResponse } from 'next/server';

import { normalizePartnerKind, type PartnerKind } from '@/lib/partners';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function pickString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function pickOptionalInt(formData: FormData, key: string): number | null {
  const raw = pickString(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const partnerKind: PartnerKind | null =
    normalizePartnerKind(formData.get('partner_kind')) ??
    normalizePartnerKind(formData.get('kind')) ??
    'leader';

  if (!partnerKind || partnerKind === 'celebrity') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'طلبات المؤثرين غير متاحة عبر النموذج العام. يُضاف المؤثرون يدوياً من لوحة الإدارة.',
      },
      { status: 400 },
    );
  }

  if (partnerKind !== 'leader' && partnerKind !== 'expert') {
    return NextResponse.json(
      { ok: false, error: 'نوع الشراكة غير صالح.' },
      { status: 400 },
    );
  }

  const name = pickString(formData, 'name');
  const phone = pickString(formData, 'phone') || pickString(formData, 'phone_wa');
  const email = pickString(formData, 'email');

  if (!name || !phone) {
    return NextResponse.json(
      { ok: false, error: 'الاسم ورقم الجوال مطلوبان.' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const payload = {
    partner_kind: partnerKind,
    name,
    email: email || null,
    phone,
    languages: pickString(formData, 'languages') || null,
    experience_years: pickOptionalInt(formData, 'experience_years'),
    preferred_destinations:
      pickString(formData, 'preferred_destinations') || null,
    platforms: pickString(formData, 'platforms') || null,
    follower_count: pickOptionalInt(formData, 'follower_count'),
    bio: pickString(formData, 'bio') || null,
    status: 'pending' as const,
  };

  const { error } = await admin.from('partner_applications').insert(payload);

  if (error) {
    console.error('[join-leader] insert failed:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'insert_failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'تم استلام طلبك بنجاح. سيراجعه فريق وندرلُوم قريباً.',
  });
}
