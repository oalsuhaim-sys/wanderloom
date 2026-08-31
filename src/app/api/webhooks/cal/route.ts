import { createHmac, timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CalWebhookBody = {
  triggerEvent?: string;
  payload?: {
    startTime?: string | null;
    attendees?: Array<{ email?: string | null }> | null;
    responses?: {
      email?: { value?: string | null } | string | null;
    } | null;
    metadata?: Record<string, unknown> | null;
    uid?: string | null;
  };
};

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

function extractClientEmail(payload: NonNullable<CalWebhookBody['payload']>): string {
  const fromAttendee = String(payload.attendees?.[0]?.email ?? '')
    .trim()
    .toLowerCase();
  if (fromAttendee.includes('@')) return fromAttendee;

  const responsesEmail = payload.responses?.email;
  const fromResponses =
    typeof responsesEmail === 'string'
      ? responsesEmail
      : String(responsesEmail?.value ?? '');
  const normalized = fromResponses.trim().toLowerCase();
  return normalized.includes('@') ? normalized : '';
}

/**
 * POST /api/webhooks/cal
 * Cal.com → update leads.meeting_date by client email.
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

  const triggerEvent = String(body.triggerEvent ?? '').trim().toUpperCase();

  // Accept created + reschedule (same email → meeting_date write)
  if (triggerEvent !== 'BOOKING_CREATED' && triggerEvent !== 'BOOKING_RESCHEDULED') {
    return NextResponse.json({ ok: true, ignored: true, triggerEvent });
  }

  const payload = body.payload ?? {};
  const clientEmail = extractClientEmail(payload);
  const meetingTimeRaw = String(payload.startTime ?? '').trim();

  if (!clientEmail) {
    console.warn('[cal/webhook] missing attendee email', { triggerEvent, uid: payload.uid });
    return NextResponse.json({ ok: false, error: 'Missing attendees[0].email' }, { status: 400 });
  }
  if (!meetingTimeRaw) {
    console.warn('[cal/webhook] missing startTime', { triggerEvent, clientEmail });
    return NextResponse.json({ ok: false, error: 'Missing payload.startTime' }, { status: 400 });
  }

  const parsed = new Date(meetingTimeRaw);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ ok: false, error: 'Invalid startTime' }, { status: 400 });
  }
  const meetingTime = parsed.toISOString();

  // Optional: prefer metadata.leadId when embed sends it
  const metaLeadId = String(
    payload.metadata?.leadId ?? payload.metadata?.lead_id ?? '',
  ).trim();

  try {
    const supabase = createSupabaseAdminClient();

    let query = supabase.from('leads').update({ meeting_date: meetingTime });

    if (metaLeadId) {
      query = query.eq('id', metaLeadId);
    } else {
      query = query.ilike('email', clientEmail);
    }

    const { data, error } = await query.select('id, email, meeting_date');

    if (error) {
      console.error('[cal/webhook] leads update failed:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const updated = data ?? [];
    console.log('[cal/webhook] meeting_date updated', {
      triggerEvent,
      clientEmail,
      meetingTime,
      rows: updated.length,
      ids: updated.map((r) => r.id),
    });

    if (updated.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No lead found for email: ${clientEmail}`,
          clientEmail,
          meeting_date: meetingTime,
        },
        { status: 404 },
      );
    }

    revalidatePath('/crm/radar');

    return NextResponse.json({
      ok: true,
      triggerEvent,
      clientEmail,
      meeting_date: meetingTime,
      updated: updated.length,
      leadIds: updated.map((r) => r.id),
    });
  } catch (err) {
    console.error('[cal/webhook]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Webhook failed' },
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
    updates: 'leads.meeting_date by email (= attendees[0].email)',
    events: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED'],
    configure:
      'Cal.com → Settings → Developer → Webhooks → https://YOUR_DOMAIN/api/webhooks/cal',
  });
}
