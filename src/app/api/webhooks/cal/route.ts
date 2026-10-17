import { createHmac, timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CalAttendee = {
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
};

type CalPayload = {
  startTime?: string | null;
  start_time?: string | null;
  booking_time?: string | null;
  endTime?: string | null;
  end_time?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  attendees?: CalAttendee[] | null;
  responses?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  uid?: string | null;
};

type CalWebhookBody = {
  triggerEvent?: string;
  event?: string;
  payload?: CalPayload;
} & CalPayload;

function verifyCalSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readLooseString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value ?? '').trim();
  }
  return '';
}

function extractClientEmail(payload: CalPayload): string {
  const fromAttendee = String(payload.attendees?.[0]?.email ?? '')
    .trim()
    .toLowerCase();
  if (fromAttendee.includes('@')) return fromAttendee;

  const direct = String(payload.email ?? '').trim().toLowerCase();
  if (direct.includes('@')) return direct;

  const fromResponses = readLooseString(payload.responses?.email).toLowerCase();
  return fromResponses.includes('@') ? fromResponses : '';
}

function extractPhoneDigits(payload: CalPayload): string {
  const attendee = payload.attendees?.[0];
  const candidates = [
    payload.phoneNumber,
    payload.phone,
    attendee?.phoneNumber,
    attendee?.phone,
    readLooseString(payload.responses?.phone),
    readLooseString(payload.responses?.phoneNumber),
    readLooseString(payload.metadata?.phone),
    readLooseString(payload.metadata?.phone_wa),
  ];
  for (const candidate of candidates) {
    const digits = String(candidate ?? '').replace(/\D/g, '');
    if (digits.length >= 8) return digits;
  }
  return '';
}

function formatMeetingDateRiyadh(iso: string): string {
  return new Date(iso).toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function readInstant(payload: CalPayload, keys: Array<keyof CalPayload>): string | null {
  for (const key of keys) {
    const raw = String(payload[key] ?? '').trim();
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

type LeadPatch = Record<string, string | null>;

type LeadMatch = {
  leadId: string;
  email: string;
  phoneDigits: string;
};

/** Writes the patch, drops unknown columns, and falls back if `meeting_scheduled` is not allowed yet. */
async function updateLeadRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  match: LeadMatch,
  patch: LeadPatch,
) {
  const current: LeadPatch = { ...patch };
  const filters: Array<'id' | 'email' | 'phone'> = [];
  if (match.leadId) filters.push('id');
  else {
    if (match.email) filters.push('email');
    if (match.phoneDigits) filters.push('phone');
  }

  let lastError = 'leads update failed';
  for (const filter of filters) {
    const attemptPatch: LeadPatch = { ...current };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let query = supabase.from('leads').update(attemptPatch);
      if (filter === 'id') query = query.eq('id', match.leadId);
      else if (filter === 'email') query = query.ilike('email', match.email);
      else query = query.ilike('phone_wa', `%${match.phoneDigits}%`);

      const { data, error } = await query.select('id, email, meeting_date, status');
      if (!error) {
        const rows = data ?? [];
        if (rows.length > 0 || filter === filters[filters.length - 1]) {
          return { data: rows, error: null as string | null };
        }
        break;
      }

      const message = error.message ?? '';
      lastError = message || lastError;
      const missing = message.match(/Could not find the '([^']+)' column/i)?.[1];
      if (missing && missing in attemptPatch) {
        delete attemptPatch[missing];
        delete current[missing];
        continue;
      }
      if (
        attemptPatch.meeting_date &&
        attemptPatch.meeting_raw_timestamp &&
        attemptPatch.meeting_date !== attemptPatch.meeting_raw_timestamp &&
        /timestamp|timestamptz|invalid input syntax|date\/time/i.test(message)
      ) {
        attemptPatch.meeting_date = attemptPatch.meeting_raw_timestamp;
        current.meeting_date = current.meeting_raw_timestamp;
        continue;
      }
      if (
        attemptPatch.status === 'meeting_scheduled' &&
        /check constraint|meeting_scheduled|invalid input value/i.test(message)
      ) {
        attemptPatch.status = 'meeting';
        current.status = 'meeting';
        continue;
      }
      if (/phone_wa|column|schema cache|does not exist/i.test(message) && filter === 'phone') {
        break;
      }
      return { data: [], error: message || 'leads update failed' };
    }
  }

  return { data: [], error: filters.length ? null : lastError };
}

/**
 * POST /api/webhooks/cal
 * Cal.com → meeting instant + radar column (inbox ↔ meetings) by email or WhatsApp.
 */
export async function POST(request: Request) {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return NextResponse.json({ ok: false, error: serviceKeyError }, { status: 500 });
  }

  const rawBody = await request.text();
  const secret = (process.env.CAL_WEBHOOK_SECRET ?? process.env.CALCOM_WEBHOOK_SECRET ?? '').trim();
  const signature =
    request.headers.get('x-cal-signature-256') ?? request.headers.get('X-Cal-Signature-256');

  if (secret && !verifyCalSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  let body: CalWebhookBody;
  try {
    body = JSON.parse(rawBody) as CalWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const triggerEvent = String(body.triggerEvent ?? body.event ?? '')
    .trim()
    .toUpperCase();
  const isSchedule = triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_RESCHEDULED';
  const isCancel = triggerEvent === 'BOOKING_CANCELLED';

  if (!isSchedule && !isCancel) {
    return NextResponse.json({ ok: true, ignored: true, triggerEvent });
  }

  const payload: CalPayload = body.payload ?? body;
  const clientEmail = extractClientEmail(payload);
  const phoneDigits = extractPhoneDigits(payload);

  if (!clientEmail && !phoneDigits) {
    console.warn('[cal/webhook] missing attendee email and phone', { triggerEvent, uid: payload.uid });
    return NextResponse.json({ ok: false, error: 'Missing attendee email or phone' }, { status: 400 });
  }

  let meetingTime: string | null = null;
  let meetingEnd: string | null = null;
  if (isSchedule) {
    meetingTime = readInstant(payload, ['startTime', 'start_time', 'booking_time']);
    if (!meetingTime) {
      console.warn('[cal/webhook] missing startTime', { triggerEvent, clientEmail });
      return NextResponse.json({ ok: false, error: 'لا يوجد توقيت صالح' }, { status: 400 });
    }
    meetingEnd = readInstant(payload, ['endTime', 'end_time']);
  }

  const metaLeadId = String(payload.metadata?.leadId ?? payload.metadata?.lead_id ?? '').trim();

  const patch: LeadPatch = isCancel
    ? {
        status: 'new',
        booking_status: 'تم إلغاء الموعد',
        meeting_date: null,
        meeting_raw_timestamp: null,
        meeting_end_timestamp: null,
      }
    : {
        status: 'meeting_scheduled',
        booking_status: triggerEvent === 'BOOKING_RESCHEDULED' ? 'تم تعديل الموعد' : 'تمت جدولة الاجتماع',
        meeting_date: meetingTime ? formatMeetingDateRiyadh(meetingTime) : meetingTime,
        meeting_raw_timestamp: meetingTime,
        meeting_end_timestamp: meetingEnd,
      };

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await updateLeadRows(
      supabase,
      { leadId: metaLeadId, email: clientEmail, phoneDigits },
      patch,
    );

    if (error) {
      console.error('[cal/webhook] leads update failed:', error);
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    console.log('[cal/webhook] lead radar status updated', {
      triggerEvent,
      clientEmail,
      phoneDigits: phoneDigits ? 'present' : '',
      meetingTime,
      rows: data.length,
      ids: data.map((row) => row.id),
      statuses: data.map((row) => row.status),
    });

    if (data.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No lead found for email: ${clientEmail || phoneDigits}`,
          clientEmail,
          meeting_date: meetingTime,
        },
        { status: 404 },
      );
    }

    revalidatePath('/crm/radar');

    return NextResponse.json({
      success: true,
      message: 'Cal event synced',
      ok: true,
      triggerEvent,
      clientEmail,
      meeting_date: meetingTime,
      status: data[0]?.status ?? patch.status,
      updated: data.length,
      leadIds: data.map((row) => row.id),
    });
  } catch (err) {
    console.error('Cal Webhook Processing Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Error' },
      { status: 500 },
    );
  }
}

/** Health check — open in browser to verify the route is live */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/cal',
    method: 'POST',
    updates:
      'BOOKING_CREATED/RESCHEDULED → status meeting_scheduled + meeting_date ISO; BOOKING_CANCELLED → status new and meeting cleared. Match by email, then phone_wa.',
    events: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'],
    configure:
      'Cal.com → Settings → Developer → Webhooks → https://YOUR_DOMAIN/api/webhooks/cal',
  });
}
