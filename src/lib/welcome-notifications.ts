import 'server-only';

import { sendWhatsAppMessage } from '@/lib/whatsapp-send-server';

export type WelcomeCustomerData = {
  name: string;
  phone?: string | null;
  email?: string | null;
  clientId?: string | null;
};

export type WelcomeTripData = {
  title: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  tripId?: string | null;
  amountPaid?: number | null;
};

export type WelcomeNotificationResult = {
  ok: boolean;
  simulated?: boolean;
  channels: Array<'whatsapp' | 'email' | 'log'>;
  error?: string;
};

function formatTripDates(start?: string | null, end?: string | null): string {
  const s = String(start ?? '').trim();
  const e = String(end ?? '').trim();
  if (s && e) return `${s} → ${e}`;
  if (s) return s;
  if (e) return e;
  return '';
}

/** نص ترحيب عربي بعد تأكيد الدفع */
export function buildPaymentWelcomeMessage(
  customer: WelcomeCustomerData,
  trip: WelcomeTripData,
): string {
  const name = String(customer.name ?? '').trim() || 'ضيفنا الكريم';
  const title = String(trip.title ?? '').trim() || 'رحلتك مع Wanderloom';
  const destination = String(trip.destination ?? '').trim();
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const amount =
    trip.amountPaid != null && Number.isFinite(Number(trip.amountPaid))
      ? Number(trip.amountPaid).toLocaleString('ar-SA')
      : '';

  const lines = [
    `مرحباً ${name}! 🌟`,
    'يسعدنا إبلاغك بأنه تم تأكيد دفعتك بنجاح — أهلاً بك رسمياً في عائلة Wanderloom.',
    '',
    `✈️ الرحلة: ${title}`,
  ];
  if (destination) lines.push(`📍 الوجهة: ${destination}`);
  if (dates) lines.push(`📅 التواريخ: ${dates}`);
  if (amount) lines.push(`💳 المبلغ المؤكد: ${amount} ر.س`);
  lines.push(
    '',
    'فريق العمليات سيبدأ تجهيز تفاصيل رحلتك وسيتواصل معك قريباً لأي مستندات مطلوبة.',
    'شكراً لثقتك — Wanderloom',
  );
  return lines.join('\n');
}

/**
 * Automated welcome after payment verification.
 * Logs payload always; sends WhatsApp when WHATSAPP_PROVIDER is configured.
 * Email hook reserved for RESEND_API_KEY / SMTP client mail later.
 */
export async function sendWelcomeNotification(
  customerData: WelcomeCustomerData,
  tripData: WelcomeTripData,
): Promise<WelcomeNotificationResult> {
  const phone = String(customerData.phone ?? '').trim();
  const email = String(customerData.email ?? '').trim();
  const title = String(tripData.title ?? '').trim() || 'رحلة Wanderloom';
  const message = buildPaymentWelcomeMessage(customerData, tripData);

  console.log('Sending Welcome Message to:', phone || '(no phone)', 'For Trip:', title);
  console.log('[welcome-notification] payload', {
    customer: {
      name: customerData.name,
      phone: phone || null,
      email: email || null,
      clientId: customerData.clientId ?? null,
    },
    trip: {
      title,
      destination: tripData.destination ?? null,
      startDate: tripData.startDate ?? null,
      endDate: tripData.endDate ?? null,
      tripId: tripData.tripId ?? null,
      amountPaid: tripData.amountPaid ?? null,
    },
    messagePreview: message.slice(0, 220),
  });

  const channels: WelcomeNotificationResult['channels'] = ['log'];
  let simulated = true;
  let lastError: string | undefined;

  if (phone) {
    const wa = await sendWhatsAppMessage({
      phone,
      name: customerData.name,
      message,
    });
    if (wa.ok) {
      channels.push('whatsapp');
      if (!wa.simulated) simulated = false;
    } else {
      lastError = wa.error;
      console.warn('[welcome-notification] WhatsApp failed:', wa.error);
    }
  } else {
    lastError = 'لا يوجد رقم واتساب للعميل';
  }

  // Email provider hook (Resend / SMTP) — structured for later API keys
  const resendKey = String(process.env.RESEND_API_KEY ?? '').trim();
  const resendFrom = String(process.env.RESEND_FROM_EMAIL ?? '').trim();
  if (email && resendKey && resendFrom) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: `تم تأكيد حجزك — ${title}`,
          text: message,
        }),
      });
      if (res.ok) {
        channels.push('email');
        simulated = false;
      } else {
        const text = await res.text().catch(() => '');
        console.warn('[welcome-notification] Resend failed:', res.status, text.slice(0, 200));
        lastError = lastError || `Resend ${res.status}`;
      }
    } catch (err) {
      console.warn('[welcome-notification] Resend error:', err);
      lastError = lastError || (err instanceof Error ? err.message : 'email failed');
    }
  } else if (email) {
    console.log('[welcome-notification] email skipped (set RESEND_API_KEY + RESEND_FROM_EMAIL)', {
      email,
    });
  }

  const delivered = channels.includes('whatsapp') || channels.includes('email');
  return {
    ok: delivered || channels.includes('log'),
    simulated: delivered ? simulated : true,
    channels,
    error: delivered ? undefined : lastError,
  };
}
