import 'server-only';

import { escapeEmailHtml, sendCustomerEmail } from '@/lib/emailAlert';
import { markDnaLinkSent } from '@/lib/client-intake-pipeline';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-send-server';

/**
 * Zero-Wait onboarding — optional automatic welcome (WhatsApp + email) with the DNA link.
 *
 * OFF by default. The CRM policy is that staff send DNA links manually; this channel only
 * runs when the owner opts in with `INSTANT_DNA_AUTO_MESSAGES=on` (Vercel env).
 * WhatsApp still needs a real provider (`WHATSAPP_PROVIDER` ≠ log) to leave the server;
 * email needs SMTP_HOST / SMTP_USER / SMTP_PASS. Never throws into the public flow.
 */
export function isInstantDnaAutoMessagesEnabled(): boolean {
  const raw = String(process.env.INSTANT_DNA_AUTO_MESSAGES ?? '')
    .trim()
    .toLowerCase();
  return raw === 'on' || raw === 'true' || raw === '1' || raw === 'yes';
}

export type InstantDnaWelcomeInput = {
  clientId: number;
  fullName: string;
  phoneWa: string;
  email?: string | null;
  dnaUrl: string;
  destinations: string[];
  travelDate?: string | null;
  travelDays?: number | null;
  travelersCount?: number | null;
};

export type InstantDnaWelcomeResult = {
  enabled: boolean;
  whatsapp: 'sent' | 'simulated' | 'failed' | 'skipped';
  email: 'sent' | 'failed' | 'skipped';
  errors: string[];
};

function summaryLines(input: InstantDnaWelcomeInput): string[] {
  const lines: string[] = [];
  if (input.destinations.length) lines.push(`الوجهة: ${input.destinations.join('، ')}`);
  if (input.travelDate) lines.push(`التاريخ التقريبي: ${input.travelDate}`);
  if (input.travelDays) lines.push(`المدة: ${input.travelDays} يوم`);
  if (input.travelersCount) lines.push(`المسافرون: ${input.travelersCount}`);
  return lines;
}

export function buildInstantDnaWelcomeMessage(input: InstantDnaWelcomeInput): string {
  const name = input.fullName.trim() || 'ضيفنا الكريم';
  const summary = summaryLines(input);
  return [
    `أهلاً ${name} ✨`,
    'استلمنا طلب رحلتك في Wanderloom.',
    ...(summary.length ? ['', 'ملخص طلبك:', ...summary.map((l) => `• ${l}`)] : []),
    '',
    'الخطوة التالية: أكمل بصمة سفرك (Travel DNA) لنفصّل الرحلة على ذوقك:',
    input.dnaUrl,
    '',
    'واندرلوم: تفصيل لا تنظيم',
  ].join('\n');
}

function buildInstantDnaWelcomeEmailHtml(input: InstantDnaWelcomeInput): string {
  const name = escapeEmailHtml(input.fullName.trim() || 'ضيفنا الكريم');
  const rows = summaryLines(input)
    .map((line) => {
      const [label, ...rest] = line.split(':');
      return `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;color:#6b746e">${escapeEmailHtml(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:700">${escapeEmailHtml(rest.join(':').trim())}</td></tr>`;
    })
    .join('');
  const link = escapeEmailHtml(input.dnaUrl);
  return `
    <div dir="rtl" style="background:#F4EFE6;padding:32px;font-family:Tahoma,Arial,sans-serif;color:#1C2E3A">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e8dcc0;border-radius:20px;overflow:hidden">
        <div style="background:#1C2E3A;padding:24px 28px;color:#F4EFE6">
          <div style="color:#C9A45C;font-size:12px;font-weight:700;letter-spacing:2px">WANDERLOOM · TRAVEL DNA</div>
          <h1 style="margin:10px 0 0;font-size:22px">أهلاً ${name}، استلمنا طلب رحلتك</h1>
        </div>
        <div style="padding:28px">
          ${rows ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;margin-bottom:22px">${rows}</table>` : ''}
          <p style="margin:0 0 22px;line-height:1.9;color:#4b5563">الخطوة التالية: أكمل بصمة سفرك (Travel DNA) لنفصّل رحلتك على ذوقك.</p>
          <div style="text-align:center">
            <a href="${link}" style="display:inline-block;background:#9C7A3C;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700">ابدأ تخصيص تفضيلات رحلتك</a>
          </div>
          <p dir="ltr" style="margin:18px 0 0;font-size:12px;color:#9ca3af;text-align:center;word-break:break-all">${link}</p>
          <p style="margin:26px 0 0;text-align:center;color:#9C7A3C;font-weight:700">واندرلوم: تفصيل لا تنظيم</p>
        </div>
      </div>
    </div>`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Runs inside `after()` — the visitor already has their DNA link on screen. */
export async function deliverInstantDnaWelcome(input: InstantDnaWelcomeInput): Promise<InstantDnaWelcomeResult> {
  const result: InstantDnaWelcomeResult = { enabled: isInstantDnaAutoMessagesEnabled(), whatsapp: 'skipped', email: 'skipped', errors: [] };
  if (!result.enabled) return result;

  let delivered = false;

  try {
    const wa = await sendWhatsAppMessage({
      phone: input.phoneWa,
      name: input.fullName,
      message: buildInstantDnaWelcomeMessage(input),
      dnaLink: input.dnaUrl,
    });
    if (wa.ok) {
      result.whatsapp = wa.simulated ? 'simulated' : 'sent';
      if (!wa.simulated) delivered = true;
    } else {
      result.whatsapp = 'failed';
      result.errors.push(`whatsapp: ${wa.error}`);
    }
  } catch (err) {
    result.whatsapp = 'failed';
    result.errors.push(`whatsapp: ${err instanceof Error ? err.message : String(err)}`);
  }

  const email = String(input.email ?? '').trim();
  if (email && EMAIL_RE.test(email)) {
    try {
      const ok = Boolean(await sendCustomerEmail(email, 'Wanderloom · استلمنا طلب رحلتك — خطوتك التالية', buildInstantDnaWelcomeEmailHtml(input)));
      result.email = ok ? 'sent' : 'failed';
      if (ok) delivered = true;
    } catch (err) {
      result.email = 'failed';
      result.errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (delivered) {
    try {
      await markDnaLinkSent(createSupabaseAdminClient(), input.clientId);
    } catch (err) {
      result.errors.push(`dna_link_sent_at: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (result.errors.length) console.warn('[instant-dna-delivery]', result.errors.join(' | '));
  return result;
}
