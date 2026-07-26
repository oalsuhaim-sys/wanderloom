import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAdmin } from '@/lib/supabase/route-handler';

type AvailabilityStatus = 'available' | 'unavailable';

function jsonWithCookies(
  body: unknown,
  status: number,
  getResponse: () => NextResponse,
) {
  const response = NextResponse.json(body, { status });
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status ?? 403,
      auth.getResponse,
    );
  }

  const leaderId = request.nextUrl.searchParams.get('leader_id')?.trim() ?? '';
  if (!leaderId) {
    return jsonWithCookies(
      { ok: false, error: 'leader_id مطلوب' },
      400,
      auth.getResponse,
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'server_config' },
      503,
      auth.getResponse,
    );
  }

  const { data, error } = await admin
    .from('leader_availability')
    .select('id, leader_id, start_date, end_date, status')
    .eq('leader_id', leaderId)
    .order('start_date', { ascending: true });

  if (error) {
    return jsonWithCookies(
      { ok: false, error: error.message },
      500,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    { ok: true, records: data ?? [] },
    200,
    auth.getResponse,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireCrmAdmin(request);
  if ('error' in auth) {
    return jsonWithCookies(
      { ok: false, error: auth.error },
      auth.status ?? 403,
      auth.getResponse,
    );
  }

  let body: {
    id?: string;
    leader_id?: string;
    start_date?: string;
    end_date?: string;
    status?: AvailabilityStatus;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'invalid_body' },
      400,
      auth.getResponse,
    );
  }

  const id = String(body.id ?? '').trim();
  const leaderId = String(body.leader_id ?? '').trim();
  const startDate = String(body.start_date ?? '').trim();
  const endDate = String(body.end_date ?? '').trim();
  const status = String(body.status ?? '').trim() as AvailabilityStatus;

  if (!leaderId || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return jsonWithCookies(
      { ok: false, error: 'بيانات القائد ونطاق التاريخ مطلوبة.' },
      400,
      auth.getResponse,
    );
  }
  if (endDate < startDate) {
    return jsonWithCookies(
      { ok: false, error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' },
      400,
      auth.getResponse,
    );
  }
  if (status !== 'available' && status !== 'unavailable') {
    return jsonWithCookies(
      { ok: false, error: 'حالة التفرغ غير صالحة.' },
      400,
      auth.getResponse,
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return jsonWithCookies(
      { ok: false, error: 'server_config' },
      503,
      auth.getResponse,
    );
  }

  const leader = await admin
    .from('leaders')
    .select('id')
    .eq('id', leaderId)
    .maybeSingle();
  if (leader.error) {
    return jsonWithCookies(
      { ok: false, error: leader.error.message },
      500,
      auth.getResponse,
    );
  }
  if (!leader.data) {
    return jsonWithCookies(
      { ok: false, error: 'القائد غير موجود.' },
      404,
      auth.getResponse,
    );
  }

  const values = {
    leader_id: leaderId,
    start_date: startDate,
    end_date: endDate,
    status,
  };
  const query = id
    ? admin
        .from('leader_availability')
        .update(values)
        .eq('id', id)
        .eq('leader_id', leaderId)
    : admin.from('leader_availability').insert(values);

  const { data, error } = await query
    .select('id, leader_id, start_date, end_date, status')
    .maybeSingle();

  if (error) {
    return jsonWithCookies(
      { ok: false, error: error.message },
      500,
      auth.getResponse,
    );
  }
  if (!data) {
    return jsonWithCookies(
      { ok: false, error: 'تعذر العثور على فترة التفرغ.' },
      404,
      auth.getResponse,
    );
  }

  return jsonWithCookies(
    { ok: true, record: data },
    id ? 200 : 201,
    auth.getResponse,
  );
}
