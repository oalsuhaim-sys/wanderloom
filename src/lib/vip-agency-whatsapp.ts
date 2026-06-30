import { normalizeWhatsAppPhoneDigits } from '@/lib/vip-portal-share'

const DEFAULT_AGENCY_WHATSAPP = '966544948640'

const BUTLER_MESSAGE_AR =
  'أهلاً، أحتاج إلى مساعدة بخصوص مسار رحلتي'

export function resolveAgencyWhatsAppDigits(): string {
  const raw =
    process.env.NEXT_PUBLIC_AGENCY_WHATSAPP ??
    process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ??
    DEFAULT_AGENCY_WHATSAPP
  return normalizeWhatsAppPhoneDigits(raw) ?? DEFAULT_AGENCY_WHATSAPP
}

export function buildVipButlerWhatsAppUrl(customMessage?: string): string {
  const digits = resolveAgencyWhatsAppDigits()
  const text = encodeURIComponent((customMessage ?? BUTLER_MESSAGE_AR).trim())
  return `https://wa.me/${digits}?text=${text}`
}
