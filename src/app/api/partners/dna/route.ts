import { NextResponse } from 'next/server';

import {
  EMPTY_PARTNER_DNA,
  PARTNER_TABLE_BY_TYPE,
  parsePartnerDnaProfile,
  parsePartnerDnaType,
  serializePartnerDnaProfile,
  type PartnerDnaType,
} from '@/lib/partner-dna';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function dnaMissingColumnError(message: string | undefined): boolean {
  return /dna_profile|column|schema cache|does not exist/i.test(message ?? '');
}

async function loadPartner(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  type: PartnerDnaType,
  id: string,
) {
  const table = PARTNER_TABLE_BY_TYPE[type];

  const { data, error } = await admin.from(table).select('*').eq('id', id).maybeSingle();

  if (error && dnaMissingColumnError(error.message)) {
    const fallback = await admin
      .from(table)
      .select('id, name, phone, email, status')
      .eq('id', id)
      .maybeSingle();
    return { data: fallback.data, error: fallback.error, dnaMissing: true as const };
  }

  return { data, error, dnaMissing: false as const };
}

/** قراءة عامة لبصمة الشريك */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get('id') ?? '').trim();
  const type = parsePartnerDnaType(searchParams.get('type'));

  if (!id || !type) {
    return NextResponse.json({ ok: false, error: 'missing_id_or_type' }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const { data, error, dnaMissing } = await loadPartner(admin, type, id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const row = data as unknown as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    partner: {
      id: String(row.id),
      name: String(row.name ?? ''),
      type,
      phone: row.phone != null ? String(row.phone) : null,
      email: row.email != null ? String(row.email) : null,
      specialtyRegions:
        row.specialty_regions != null ? String(row.specialty_regions) : null,
      dnaProfile: dnaMissing
        ? EMPTY_PARTNER_DNA
        : parsePartnerDnaProfile(row.dna_profile),
    },
  });
}

async function upsertDna(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const id = String(body.id ?? '').trim();
  const type = parsePartnerDnaType(body.type);
  const dnaRaw = body.dnaData ?? body.dna_data ?? body.dnaProfile ?? body.dna_profile ?? body;

  if (!id || !type) {
    return NextResponse.json({ ok: false, error: 'missing_id_or_type' }, { status: 400 });
  }

  const parsed = parsePartnerDnaProfile(dnaRaw);
  if (
    parsed.specialSkills.length === 0 &&
    parsed.preferredStyles.length === 0 &&
    parsed.approvedDestinations.length === 0 &&
    parsed.routingStyles.length === 0 &&
    parsed.activityStrengths.length === 0 &&
    !parsed.tripStyle &&
    !parsed.strengths &&
    !parsed.competitiveAdvantage &&
    !parsed.agencyRequirements
  ) {
    return NextResponse.json(
      { ok: false, error: 'يرجى تعبئة حقول بصمة الشريك.' },
      { status: 400 },
    );
  }
  if (type === 'leaders' && parsed.specialSkills.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'يرجى اختيار مهارة أو رخصة تخصصية واحدة على الأقل.' },
      { status: 400 },
    );
  }
  if (type === 'leaders' && parsed.preferredStyles.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'يرجى اختيار نمط رحلة مفضل واحد على الأقل.' },
      { status: 400 },
    );
  }
  if (type === 'experts' && parsed.approvedDestinations.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'يرجى اختيار وجهة معتمدة واحدة على الأقل.' },
      { status: 400 },
    );
  }
  if (type === 'experts' && parsed.routingStyles.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'يرجى اختيار أسلوب واحد على الأقل لتصميم المسارات.' },
      { status: 400 },
    );
  }
  if (type === 'experts' && parsed.activityStrengths.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'يرجى اختيار نقطة قوة واحدة على الأقل في ترتيب الفعاليات.' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const table = PARTNER_TABLE_BY_TYPE[type];
  const dna_profile = serializePartnerDnaProfile(parsed, { markSubmitted: true });

  const { data, error } = await admin
    .from(table)
    .update({ dna_profile })
    .eq('id', id)
    .select('id, name')
    .maybeSingle();

  if (error) {
    if (dnaMissingColumnError(error.message)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'عمود dna_profile غير موجود بعد. نفّذ supabase/sql/partners_dna_profile.sql في Supabase.',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message: 'تم حفظ بصمة الشريك بنجاح.',
    dnaProfile: parsePartnerDnaProfile(dna_profile),
  });
}

export async function POST(request: Request) {
  return upsertDna(request);
}

export async function PUT(request: Request) {
  return upsertDna(request);
}
