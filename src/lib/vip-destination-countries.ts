export type VipDestinationCountry = {
  code: string
  name: string
  flag: string
}

/** 21 وجهة VIP — القائمة الوحيدة المسموح بها في destination_flag */
export const VIP_DESTINATION_COUNTRIES: VipDestinationCountry[] = [
  { code: 'SA', name: 'السعودية', flag: '🇸🇦' },
  { code: 'GB', name: 'بريطانيا', flag: '🇬🇧' },
  { code: 'FR', name: 'فرنسا', flag: '🇫🇷' },
  { code: 'CH', name: 'سويسرا', flag: '🇨🇭' },
  { code: 'IT', name: 'إيطاليا', flag: '🇮🇹' },
  { code: 'ES', name: 'إسبانيا', flag: '🇪🇸' },
  { code: 'DE', name: 'ألمانيا', flag: '🇩🇪' },
  { code: 'AT', name: 'النمسا', flag: '🇦🇹' },
  { code: 'US', name: 'أمريكا', flag: '🇺🇸' },
  { code: 'CA', name: 'كندا', flag: '🇨🇦' },
  { code: 'JP', name: 'اليابان', flag: '🇯🇵' },
  { code: 'KR', name: 'كوريا الجنوبية', flag: '🇰🇷' },
  { code: 'CN', name: 'الصين', flag: '🇨🇳' },
  { code: 'RU', name: 'روسيا', flag: '🇷🇺' },
  { code: 'ZA', name: 'جنوب أفريقيا', flag: '🇿🇦' },
  { code: 'NL', name: 'هولندا', flag: '🇳🇱' },
  { code: 'BE', name: 'بلجيكا', flag: '🇧🇪' },
  { code: 'PT', name: 'البرتغال', flag: '🇵🇹' },
  { code: 'SE', name: 'السويد', flag: '🇸🇪' },
  { code: 'CZ', name: 'التشيك', flag: '🇨🇿' },
  { code: 'HU', name: 'المجر', flag: '🇭🇺' },
]

export function vipDestinationStoredValue(country: VipDestinationCountry): string {
  return `${country.flag} ${country.name}`
}

const VIP_STORED_VALUES = new Set(VIP_DESTINATION_COUNTRIES.map(vipDestinationStoredValue))

/** يطابق القيمة المحفوظة مع أقرب خيار VIP (للقوالب القديمة التي تحفظ العلم فقط) */
export function resolveVipDestinationStoredValue(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (VIP_STORED_VALUES.has(t)) return t

  for (const c of VIP_DESTINATION_COUNTRIES) {
    const stored = vipDestinationStoredValue(c)
    if (t === c.flag || t.startsWith(c.flag)) return stored
    if (t.includes(c.name)) return stored
  }

  return t
}

export function isAllowedVipDestinationValue(raw: string): boolean {
  const resolved = resolveVipDestinationStoredValue(raw)
  return resolved !== '' && VIP_STORED_VALUES.has(resolved)
}
