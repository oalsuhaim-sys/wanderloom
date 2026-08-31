import { NextResponse, type NextRequest } from 'next/server';

import {
  fetchLeaderCalendarPayload,
  saveLeaderUnavailableDatesByToken,
} from '@/lib/leader-calendar-portal';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ ok: false, error: 'الرمز مطلوب.' }, { status: 400 });
  }

  try {
    const result = await fetchLeaderCalendarPayload(token);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result.data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'تعذر التحميل.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { token?: string; unavailableDates?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح.' }, { status: 400 });
  }

  const token = String(body.token ?? '').trim();
  const dates = Array.isArray(body.unavailableDates)
    ? body.unavailableDates.map((d) => String(d))
    : [];

  if (!token) {
    return NextResponse.json({ ok: false, error: 'الرمز مطلوب.' }, { status: 400 });
  }

  try {
    const result = await saveLeaderUnavailableDatesByToken(token, dates);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'تعذر الحفظ.' },
      { status: 500 },
    );
  }
}
