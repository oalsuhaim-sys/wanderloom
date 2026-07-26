import 'server-only';

export type WhatsAppSendInput = {
  phone: string;
  name?: string;
  message?: string;
  dnaLink?: string;
};

export type WhatsAppSendResult =
  | { ok: true; provider: string; simulated?: boolean }
  | { ok: false; error: string; simulated?: boolean };

function normalizePhoneDigits(phone: string): string {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('05')) digits = `966${digits.slice(1)}`;
  else if (digits.startsWith('5') && digits.length === 9) digits = `966${digits}`;
  else if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

export function buildRegistrationDnaWhatsAppMessage(name: string, dnaLink: string): string {
  const displayName = String(name ?? '').trim() || 'ضيفنا الكريم';
  const link = String(dnaLink ?? '').trim();
  return [
    `مرحباً ${displayName}! سعداء باختيارك Wanderloom.`,
    'للبدء بتصميم رحلتك، يرجى تعبئة ملف الـ DNA الخاص بك عبر هذا الرابط:',
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

/** رسالة واتساب عند موافقة الرادار على الطلب */
export function buildRadarApprovalDnaWhatsAppMessage(name: string, dnaLink: string): string {
  const displayName = String(name ?? '').trim() || 'ضيفنا الكريم';
  const link = String(dnaLink ?? '').trim();
  return [
    `مرحباً ${displayName}! 🌟`,
    'يسعدنا إخبارك بأنه تمت الموافقة على طلبك. للبدء بتصميم رحلتك المخصصة، نرجو تعبئة ملف الـ DNA السياحي الخاص بك عبر هذا الرابط الآمن:',
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

/** كانبان: بانتظار الدفع */
export function buildKanbanAwaitingPaymentWhatsAppMessage(
  name: string,
  paymentLink: string,
): string {
  const displayName = String(name ?? '').trim() || 'ضيفنا الكريم';
  const link = String(paymentLink ?? '').trim();
  return [
    `مرحباً ${displayName} 🌟`,
    'لقد انتهينا من تصميم مسار رحلتك الساحر! يمكنك الآن مراجعته وإتمام الدفع عبر الرابط التالي:',
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

/** كانبان: رحلة نشطة */
export function buildKanbanActiveTripWhatsAppMessage(name: string): string {
  const displayName = String(name ?? '').trim() || 'ضيفنا الكريم';
  return [
    `نتمنى لك رحلة سعيدة يا ${displayName}! ✈️`,
    'فريق Wanderloom معك في كل خطوة، تواصل معنا هنا لأي مساعدة خلال رحلتك.',
  ].join('\n');
}

/** تذكير قبل المغادرة بـ 48 ساعة */
export function buildPreDepartureWhatsAppMessage(input: {
  name: string;
  destination: string;
  itineraryLink: string;
}): string {
  const displayName = String(input.name ?? '').trim() || 'ضيفنا الكريم';
  const destination = String(input.destination ?? '').trim() || 'وجهتك';
  const link = String(input.itineraryLink ?? '').trim();
  return [
    `مرحباً ${displayName}! رحلتك الفاخرة إلى ${destination} تبدأ بعد 48 ساعة ✈️.`,
    'تأكد من ترتيب حقائبك، مسار رحلتك بانتظارك هنا:',
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildPartnerDnaWhatsAppMessage(name: string, dnaLink: string): string {
  const displayName = String(name ?? '').trim() || 'شريكنا الكريم';
  const link = String(dnaLink ?? '').trim();
  return [
    `مرحباً ${displayName}!`,
    'نرجو منك تعبئة "بصمة الشريك" الخاصة بك لتحديد أسلوب عملك وتخصصك عبر هذا الرابط:',
    link,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Server-side WhatsApp send.
 * Configure one provider via env:
 * - WHATSAPP_PROVIDER=ultramsg|meta|twilio|log (default: log / simulated)
 * - WHATSAPP_API_KEY / WHATSAPP_API_URL / WHATSAPP_PHONE_NUMBER_ID / etc.
 */
export async function sendWhatsAppMessage(
  input: WhatsAppSendInput,
): Promise<WhatsAppSendResult> {
  const phone = normalizePhoneDigits(input.phone);
  if (!phone || phone.length < 8) {
    return { ok: false, error: 'رقم واتساب غير صالح' };
  }

  const name = String(input.name ?? '').trim();
  const dnaLink = String(input.dnaLink ?? '').trim();
  const message =
    String(input.message ?? '').trim() ||
    (dnaLink ? buildRegistrationDnaWhatsAppMessage(name, dnaLink) : '');

  if (!message) {
    return { ok: false, error: 'نص الرسالة فارغ' };
  }

  const provider = (process.env.WHATSAPP_PROVIDER ?? 'log').trim().toLowerCase();
  const apiKey = (process.env.WHATSAPP_API_KEY ?? '').trim();
  const apiUrl = (process.env.WHATSAPP_API_URL ?? '').trim();

  try {
    if (provider === 'ultramsg' && apiKey && apiUrl) {
      const instanceId =
        process.env.WHATSAPP_ULTRAMSG_INSTANCE?.trim() ||
        process.env.ULTRAMSG_INSTANCE_ID?.trim() ||
        '';
      const endpoint =
        apiUrl ||
        (instanceId
          ? `https://api.ultramsg.com/${instanceId}/messages/chat`
          : '');
      if (!endpoint) {
        return { ok: false, error: 'WHATSAPP_API_URL / instance غير مضبوط' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: apiKey,
          to: phone,
          body: message,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `UltraMsg ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, provider: 'ultramsg' };
    }

    if (provider === 'meta' && apiKey) {
      const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
      if (!phoneNumberId) {
        return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID غير مضبوط' };
      }
      const endpoint =
        apiUrl ||
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Meta ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, provider: 'meta' };
    }

    if (provider === 'twilio' && apiKey) {
      const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
      const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim();
      if (!sid || !from) {
        return { ok: false, error: 'TWILIO_ACCOUNT_SID / TWILIO_WHATSAPP_FROM غير مضبوط' };
      }
      const auth = Buffer.from(`${sid}:${apiKey}`).toString('base64');
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
            To: `whatsapp:+${phone}`,
            Body: message,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, provider: 'twilio' };
    }

    // Dev / not configured — log and treat as simulated success
    console.info('[whatsapp-send] simulated send', {
      provider,
      phone,
      name,
      preview: message.slice(0, 120),
      hasApiKey: Boolean(apiKey),
    });
    return { ok: true, provider: provider || 'log', simulated: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر إرسال واتساب',
    };
  }
}
