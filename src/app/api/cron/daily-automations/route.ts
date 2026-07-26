import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildPreDepartureWhatsAppMessage,
  sendWhatsAppMessage,
} from '@/lib/whatsapp-send-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 8:00 AM Asia/Riyadh ≈ 05:00 UTC (vercel.json schedule: 0 5 * * *) */

type ItineraryCronRow = {
  id?: unknown;
  title?: unknown;
  destination?: unknown;
  start_date?: unknown;
  magic_link_id?: unknown;
  client_id?: unknown;
  is_template?: unknown;
  status?: unknown;
  clients?:
    | {
        id?: unknown;
        name?: unknown;
        phone_wa?: unknown;
        phone?: unknown;
      }
    | {
        id?: unknown;
        name?: unknown;
        phone_wa?: unknown;
        phone?: unknown;
      }[]
    | null;
};

function siteBase(): string {
  return (
    String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
    String(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '').trim() ||
    'https://wanderloom-travel.vercel.app'
  ).replace(/\/$/, '');
}

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const alt = req.headers.get('x-cron-secret')?.trim() ?? '';
  const vercelCron = req.headers.get('x-vercel-cron')?.trim() === '1';

  if (secret) {
    return bearer === secret || alt === secret;
  }

  // Vercel Cron sends x-vercel-cron when no CRON_SECRET is configured
  if (vercelCron) return true;

  // Local / non-production only
  return process.env.NODE_ENV !== 'production';
}

function ymdPlusDays(days: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pickClient(row: ItineraryCronRow): {
  name: string;
  phone: string;
} | null {
  const raw = row.clients;
  const client = Array.isArray(raw) ? raw[0] : raw;
  if (!client) return null;
  const phone = String(client.phone_wa ?? client.phone ?? '').trim();
  if (!phone) return null;
  return {
    name: String(client.name ?? '').trim() || 'ضيفنا الكريم',
    phone,
  };
}

function itineraryPublicLink(row: ItineraryCronRow): string {
  const base = siteBase();
  const magic = String(row.magic_link_id ?? '').trim();
  const id = String(row.id ?? '').trim();
  const slug = magic || id;
  if (!slug) return base;
  return `${base}/itinerary/${encodeURIComponent(slug)}`;
}

/**
 * Daily client-experience automations (Vercel Cron).
 * Currently: Pre-departure WhatsApp ~48 hours before itinerary start_date.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 });
  }

  const targetDate = ymdPlusDays(2);
  const results = {
    targetDate,
    scanned: 0,
    sent: 0,
    simulated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    let { data, error } = await admin
      .from('itineraries')
      .select(
        'id, title, destination, start_date, magic_link_id, client_id, is_template, status, clients(id, name, phone_wa)',
      )
      .eq('start_date', targetDate)
      .limit(200);

    if (error && /is_template|clients|relationship/i.test(error.message)) {
      ({ data, error } = await admin
        .from('itineraries')
        .select('id, title, destination, start_date, magic_link_id, client_id, status')
        .eq('start_date', targetDate)
        .limit(200));
    }

    if (error) {
      console.error('[cron/daily-automations] query:', error.message);
      return NextResponse.json(
        { ok: false, error: error.message, targetDate },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as ItineraryCronRow[];
    results.scanned = rows.length;

    // Enrich clients if join was unavailable
    const needClientIds = rows
      .filter((r) => !pickClient(r) && r.client_id != null)
      .map((r) => Number(r.client_id))
      .filter((n) => Number.isFinite(n));

    const clientById = new Map<number, { name: string; phone_wa: string }>();
    if (needClientIds.length) {
      const { data: clients } = await admin
        .from('clients')
        .select('id, name, phone_wa')
        .in('id', [...new Set(needClientIds)]);
      for (const c of clients ?? []) {
        const id = Number((c as { id?: unknown }).id);
        if (!Number.isFinite(id)) continue;
        clientById.set(id, {
          name: String((c as { name?: unknown }).name ?? '').trim(),
          phone_wa: String((c as { phone_wa?: unknown }).phone_wa ?? '').trim(),
        });
      }
    }

    for (const row of rows) {
      if (row.is_template === true) {
        results.skipped += 1;
        continue;
      }

      let client = pickClient(row);
      if (!client && row.client_id != null) {
        const fallback = clientById.get(Number(row.client_id));
        if (fallback?.phone_wa) {
          client = {
            name: fallback.name || 'ضيفنا الكريم',
            phone: fallback.phone_wa,
          };
        }
      }

      if (!client) {
        results.skipped += 1;
        results.errors.push(`itinerary ${String(row.id)}: missing client phone`);
        continue;
      }

      const destination =
        String(row.destination ?? '').trim() ||
        String(row.title ?? '').trim() ||
        'وجهتك';
      const itineraryLink = itineraryPublicLink(row);
      const message = buildPreDepartureWhatsAppMessage({
        name: client.name,
        destination,
        itineraryLink,
      });

      try {
        const wa = await sendWhatsAppMessage({
          phone: client.phone,
          name: client.name,
          message,
        });
        if (wa.ok) {
          results.sent += 1;
          if (wa.simulated) results.simulated += 1;
        } else {
          results.errors.push(`itinerary ${String(row.id)}: ${wa.error}`);
        }
      } catch (err) {
        results.errors.push(
          `itinerary ${String(row.id)}: ${err instanceof Error ? err.message : 'send failed'}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      processed: results.sent,
      ...results,
    });
  } catch (err) {
    console.error('[cron/daily-automations]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'cron failed',
        targetDate,
      },
      { status: 500 },
    );
  }
}
