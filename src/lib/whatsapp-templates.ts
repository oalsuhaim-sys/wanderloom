import { normalizeWhatsAppPhoneDigits } from '@/lib/vip-portal-share';

export type WhatsAppTemplateId = 'send_quote' | 'follow_up';

export type WhatsAppTemplateContext = {
  clientName: string;
  tripTitle: string;
  priceFormatted: string;
  quoteLink: string;
};

export const WHATSAPP_TEMPLATE_OPTIONS: Array<{ id: WhatsAppTemplateId; label: string }> = [
  { id: 'send_quote', label: 'إرسال عرض السعر' },
  { id: 'follow_up', label: 'متابعة العميل' },
];

export const whatsappTemplates = {
  send_quote: (name: string, trip: string, price: string, link: string) =>
    [
      `مرحباً ${name}،`,
      '',
      `يسعدنا في Wanderloom مشاركتكم عرض السعر الخاص برحلتكم (${trip}).`,
      '',
      `💰 إجمالي العرض: ${price}`,
      '',
      'يمكنكم مراجعة التفاصيل الكاملة والموافقة على العرض عبر الرابط التالي:',
      link,
      '',
      'نأمل أن ينال إعجابكم — فريق Wanderloom ✨',
    ].join('\n'),

  follow_up: (name: string, trip: string) =>
    [
      `مرحباً ${name}،`,
      '',
      `نود متابعة عرض السعر الخاص برحلتكم (${trip}).`,
      '',
      'هل لديكم أي استفسار أو تعديلات قبل المتابعة؟',
      '',
      'يسعدنا تواصلكم في أي وقت.',
      '',
      'فريق Wanderloom ✨',
    ].join('\n'),
};

export function buildWhatsAppTemplateMessage(
  templateId: WhatsAppTemplateId,
  ctx: WhatsAppTemplateContext,
): string {
  if (templateId === 'send_quote') {
    return whatsappTemplates.send_quote(
      ctx.clientName,
      ctx.tripTitle,
      ctx.priceFormatted,
      ctx.quoteLink,
    );
  }
  return whatsappTemplates.follow_up(ctx.clientName, ctx.tripTitle);
}

export function formatQuotationPriceForWhatsApp(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

export function buildQuotationPublicLink(quoteId: string, origin?: string): string {
  const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return `${base}/quote/${encodeURIComponent(quoteId)}`;
}

export function openWhatsAppWithMessage(phone: string | null | undefined, message: string): boolean {
  if (typeof window === 'undefined') return false;
  const digits = normalizeWhatsAppPhoneDigits(phone);
  const encoded = encodeURIComponent(message);
  const url = digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function launchWhatsAppTemplate(input: {
  templateId: WhatsAppTemplateId;
  phone?: string | null;
  clientName: string;
  tripTitle: string;
  totalEstimatedCost: number;
  quoteId: string;
  origin?: string;
}): boolean {
  const message = buildWhatsAppTemplateMessage(input.templateId, {
    clientName: input.clientName.trim() || 'عميلنا الكريم',
    tripTitle: input.tripTitle.trim() || 'رحلتكم القادمة',
    priceFormatted: formatQuotationPriceForWhatsApp(input.totalEstimatedCost),
    quoteLink: buildQuotationPublicLink(input.quoteId, input.origin),
  });
  return openWhatsAppWithMessage(input.phone, message);
}
