import { VIP_DESTINATION_COUNTRIES } from '@/lib/vip-destination-countries'

export type PartnerAvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'booked'

/** ISO / common aliases → emoji + Arabic name */
const EXTRA_FLAGS: Record<string, { flag: string; name: string }> = {
  AE: { flag: '🇦🇪', name: 'الإمارات' },
  EG: { flag: '🇪🇬', name: 'مصر' },
  JO: { flag: '🇯🇴', name: 'الأردن' },
  KW: { flag: '🇰🇼', name: 'الكويت' },
  BH: { flag: '🇧🇭', name: 'البحرين' },
  QA: { flag: '🇶🇦', name: 'قطر' },
  OM: { flag: '🇴🇲', name: 'عُمان' },
  TR: { flag: '🇹🇷', name: 'تركيا' },
  MA: { flag: '🇲🇦', name: 'المغرب' },
  ID: { flag: '🇮🇩', name: 'إندونيسيا' },
  TH: { flag: '🇹🇭', name: 'تايلاند' },
  MY: { flag: '🇲🇾', name: 'ماليزيا' },
  SG: { flag: '🇸🇬', name: 'سنغافورة' },
  AU: { flag: '🇦🇺', name: 'أستراليا' },
  NZ: { flag: '🇳🇿', name: 'نيوزيلندا' },
  GR: { flag: '🇬🇷', name: 'اليونان' },
  HR: { flag: '🇭🇷', name: 'كرواتيا' },
  PL: { flag: '🇵🇱', name: 'بولندا' },
  IE: { flag: '🇮🇪', name: 'أيرلندا' },
  NO: { flag: '🇳🇴', name: 'النرويج' },
  DK: { flag: '🇩🇰', name: 'الدنمارك' },
  FI: { flag: '🇫🇮', name: 'فنلندا' },
  MX: { flag: '🇲🇽', name: 'المكسيك' },
  BR: { flag: '🇧🇷', name: 'البرازيل' },
  AR: { flag: '🇦🇷', name: 'الأرجنتين' },
  IN: { flag: '🇮🇳', name: 'الهند' },
  PK: { flag: '🇵🇰', name: 'باكستان' },
  LB: { flag: '🇱🇧', name: 'لبنان' },
  IQ: { flag: '🇮🇶', name: 'العراق' },
  SY: { flag: '🇸🇾', name: 'سوريا' },
  YE: { flag: '🇾🇪', name: 'اليمن' },
  SD: { flag: '🇸🇩', name: 'السودان' },
  TN: { flag: '🇹🇳', name: 'تونس' },
  DZ: { flag: '🇩🇿', name: 'الجزائر' },
  LY: { flag: '🇱🇾', name: 'ليبيا' },
}

export function countryFlagMeta(countryCode: string | null | undefined): {
  flag: string
  name: string
} | null {
  const code = String(countryCode ?? '')
    .trim()
    .toUpperCase()
  if (!code) return null

  const vip = VIP_DESTINATION_COUNTRIES.find((c) => c.code === code)
  if (vip) return { flag: vip.flag, name: vip.name }

  const extra = EXTRA_FLAGS[code]
  if (extra) return extra

  // Regional indicator symbols from ISO alpha-2
  if (/^[A-Z]{2}$/.test(code)) {
    const flag = String.fromCodePoint(
      ...[...code].map((ch) => 127397 + ch.charCodeAt(0)),
    )
    return { flag, name: code }
  }

  return null
}

export function formatPartnerLocation(
  countryCode: string | null | undefined,
  city: string | null | undefined,
): string | null {
  const meta = countryFlagMeta(countryCode)
  const cityLabel = String(city ?? '').trim()
  if (!meta && !cityLabel) return null
  if (meta && cityLabel) return `${meta.flag} ${meta.name} — ${cityLabel}`
  if (meta) return `${meta.flag} ${meta.name}`
  return cityLabel
}

export function normalizePartnerAvailability(
  raw: unknown,
): PartnerAvailabilityStatus | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'available' || s === 'متاح') return 'available'
  if (s === 'busy' || s === 'booked' || s === 'في رحلة' || s === 'مشغول') return 'busy'
  if (s === 'unavailable' || s === 'غير متاح') return 'unavailable'
  return null
}

export function partnerAvailabilityBadge(
  status: PartnerAvailabilityStatus | null,
): { label: string; className: string } | null {
  if (status === 'available') {
    return {
      label: 'متاح حالياً 🟢',
      className:
        'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    }
  }
  if (status === 'busy') {
    return {
      label: 'في رحلة 🟡',
      className:
        'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300',
    }
  }
  if (status === 'unavailable') {
    return {
      label: 'غير متاح',
      className:
        'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-400',
    }
  }
  return null
}

export function formatPartnerRating(rating: number | null | undefined): string | null {
  if (rating == null) return null
  const n = Number(rating)
  if (!Number.isFinite(n) || n <= 0) return null
  return `⭐ ${n % 1 === 0 ? String(n) : n.toFixed(1)}`
}

export function formatCompletedTrips(count: number | null | undefined): string | null {
  if (count == null) return null
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (n <= 0) return null
  return `${n} رحلة ناجحة`
}
