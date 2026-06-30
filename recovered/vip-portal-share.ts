/** مشاركة رحلة VIP عبر واتساب — البوابة الموحدة فقط (بدون رابط /itinerary مباشر) */

export type ItineraryPortalPinSource = {
  passcode?: string | null
  pin_code?: string | number | null
}

export function resolveItineraryPortalPin(row: ItineraryPortalPinSource): string {
  const passcode = row.passcode != null ? String(row.passcode).trim() : ''
  if (passcode) return passcode.toUpperCase()
  const pinCode = row.pin_code != null ? String(row.pin_code).trim() : ''
  return pinCode
}

export function buildVipPortalWhatsAppMessage(
  clientPin: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const portalLink = `${origin.replace(/\/$/, '')}/portal`
  const pin = clientPin.trim()
  return [
    'مرحباً بك في Wanderloom ✨',
    '',
    'تم تجهيز مسار رحلتك الحصري بكل عناية.',
    '',
    'للدخول إلى مسارك الخاص، يرجى زيارة بوابتنا الآمنة:',
    `🔗 ${portalLink}`,
    '',
    `🔑 مفتاح رحلتك السري (PIN): ${pin}`,
    '',
    'نتمنى لك رحلة استثنائية! ✈️',
  ].join('\n')
}

export function buildVipPortalWhatsAppUrl(
  clientPin: string,
  phoneDigits?: string | null,
  origin?: string,
): string {
  const text = buildVipPortalWhatsAppMessage(clientPin, origin)
  const encoded = encodeURIComponent(text)
  const digits = phoneDigits?.replace(/\D/g, '') || ''
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${encoded}`
  }
  return `https://wa.me/?text=${encoded}`
}

/** أرقام واتساب: بدون +، إزالة 00، تحويل 0 المحلي إلى 966 */
export function normalizeWhatsAppPhoneDigits(phoneRaw: string | null | undefined): string | null {
  if (!phoneRaw) return null
  let digits = phoneRaw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length >= 10) digits = `966${digits.slice(1)}`
  if (digits.length < 8) return null
  return digits
}

export function openVipPortalWhatsAppShare(
  row: ItineraryPortalPinSource & { phone_wa?: string | null },
): boolean {
  const pin = resolveItineraryPortalPin(row)
  if (!pin) return false
  const phone = normalizeWhatsAppPhoneDigits(row.phone_wa)
  const url = buildVipPortalWhatsAppUrl(pin, phone)
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
