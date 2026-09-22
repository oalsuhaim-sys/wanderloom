import type { ClientTier, VipClientProfile } from '@/lib/clientsTravelDna'
import { resolveClientDnaDisplay } from '@/lib/clientsTravelDna'
import type { VipSpendingTier } from '@/lib/vip-spending-tier'

export type EngagementStatus = 'active' | 'warm' | 'cold'

const BIRTH_DATE_KEYS = [
  'birth_date',
  'dob',
  'birthdate',
  'date_of_birth',
  'birth_day',
  'birthday',
  'date_of_birth_gregorian',
] as const

function coerceBirthDateValue(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return readBirthDateFromRow(raw as Record<string, unknown>)
  }
  const value = String(raw).trim()
  if (!value) return null

  const iso = value.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso?.[1]) return iso[1]

  const dmy = value.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/)
  if (dmy) {
    const dd = dmy[1]!.padStart(2, '0')
    const mm = dmy[2]!.padStart(2, '0')
    const yyyy = dmy[3]!
    return `${yyyy}-${mm}-${dd}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

function readBirthDateFromRow(row: Record<string, unknown>): string | null {
  for (const key of BIRTH_DATE_KEYS) {
    const found = coerceBirthDateValue(row[key])
    if (found) return found
  }

  for (const nestKey of [
    'passenger_info',
    'passenger',
    'profile',
    'details',
    'meta',
    'preferences',
  ] as const) {
    const nested = row[nestKey]
    if (nested == null) continue
    if (typeof nested === 'string') {
      const trimmed = nested.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const found = readBirthDateFromRow(JSON.parse(trimmed) as Record<string, unknown>)
          if (found) return found
        } catch {
          /* ignore */
        }
      }
      const found = coerceBirthDateValue(trimmed)
      if (found) return found
      continue
    }
    if (typeof nested === 'object') {
      const found = readBirthDateFromRow(nested as Record<string, unknown>)
      if (found) return found
    }
  }

  for (const textKey of ['notes', 'final_thoughts', 'special_notes', 'details'] as const) {
    const text = String(row[textKey] ?? '').trim()
    if (!text) continue
    const labeled = text.match(
      /(?:birth[_\s-]?date|dob|date[_\s-]?of[_\s-]?birth)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i,
    )
    if (labeled?.[1]) {
      const found = coerceBirthDateValue(labeled[1])
      if (found) return found
    }
  }

  return null
}

/**
 * Resolve a birth date string from a client row and/or nested `group_members` / leads.
 * SSOT: prefer `clients.birth_date` (and aliases on the client row), then related tables.
 */
export function resolveClientBirthDate(
  client: Record<string, unknown> | null | undefined,
): string | null {
  if (!client || typeof client !== 'object') return null

  const fromClient = readBirthDateFromRow(client)
  if (fromClient) return fromClient

  const members = client.group_members
  if (Array.isArray(members)) {
    const sorted = [...members].sort((a, b) => {
      const aAt = String((a as Record<string, unknown>)?.created_at ?? '')
      const bAt = String((b as Record<string, unknown>)?.created_at ?? '')
      return bAt.localeCompare(aAt)
    })
    for (const member of sorted) {
      if (!member || typeof member !== 'object') continue
      const fromMember = readBirthDateFromRow(member as Record<string, unknown>)
      if (fromMember) return fromMember
    }
  } else if (members && typeof members === 'object') {
    const fromMember = readBirthDateFromRow(members as Record<string, unknown>)
    if (fromMember) return fromMember
  }

  const leads = client.leads
  if (Array.isArray(leads)) {
    for (const lead of leads) {
      if (!lead || typeof lead !== 'object') continue
      const fromLead = readBirthDateFromRow(lead as Record<string, unknown>)
      if (fromLead) return fromLead
    }
  } else if (leads && typeof leads === 'object') {
    const fromLead = readBirthDateFromRow(leads as Record<string, unknown>)
    if (fromLead) return fromLead
  }

  return null
}

/**
 * Exact age in full years from a birth date string (clients.birth_date / dob).
 * Returns null when missing / invalid / non-positive.
 */
export function calculateAge(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null

  const trimmed = String(birthDateStr).trim()
  if (!trimmed) return null

  const iso = trimmed.slice(0, 10)
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--

  return age > 0 ? age : null
}

/** Approximate ISO birth date when only a numeric age was collected at registration. */
export function approximateBirthDateFromAge(ageRaw: unknown): string | null {
  const age = Math.floor(Number(ageRaw))
  if (!Number.isFinite(age) || age < 1 || age > 120) return null
  const year = new Date().getFullYear() - age
  if (year < 1900 || year > new Date().getFullYear()) return null
  return `${year}-01-01`
}

function readAgeFromTravelDna(travelDna: unknown): number | null {
  if (!travelDna || typeof travelDna !== 'object' || Array.isArray(travelDna)) return null
  const raw = (travelDna as Record<string, unknown>).age
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1 || n > 120) return null
  return n
}

/** Parse numeric age from registration notes / JSON blobs (e.g. «العمر: 28»). */
export function extractAgeFromRegistrationMeta(raw: unknown): number | null {
  if (raw == null) return null

  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d{1,3}$/.test(raw.trim()))) {
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n) && n >= 1 && n <= 120) return n
  }

  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    const direct = Math.floor(Number(row.age ?? row.passenger_age ?? row.client_age))
    if (Number.isFinite(direct) && direct >= 1 && direct <= 120) return direct

    for (const key of ['preferences', 'passenger_info', 'notes', 'final_thoughts', 'travel_dna']) {
      const nested = extractAgeFromRegistrationMeta(row[key])
      if (nested != null) return nested
    }

    try {
      const asText = JSON.stringify(raw)
      const fromJsonText = extractAgeFromRegistrationMeta(asText)
      if (fromJsonText != null) return fromJsonText
    } catch {
      /* ignore */
    }
    return null
  }

  const text = String(raw)
  const patterns = [
    /العمر\s*[:：]?\s*(\d{1,3})/i,
    /age\s*[:＝=]?\s*(\d{1,3})/i,
    /"age"\s*:\s*(\d{1,3})/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (!m?.[1]) continue
    const n = Math.floor(Number(m[1]))
    if (Number.isFinite(n) && n >= 1 && n <= 120) return n
  }
  return null
}

/**
 * Display age for ClientCard / CRM UI.
 * Prefer age calculated from `clients.birth_date`, then persisted `client.age`.
 */
export function resolveClientDisplayAge(client: {
  age?: number | null
  birth_date?: string | null
  dob?: string | null
  travel_dna?: unknown
  secret_notes?: string | null
  group_members?: unknown
  [key: string]: unknown
}): number | null {
  const fromBirth = calculateAge(
    (client.birth_date || client.dob || '').toString().trim() || undefined,
  )
  if (fromBirth != null) return fromBirth

  const direct = Math.floor(Number(client.age))
  if (Number.isFinite(direct) && direct > 0 && direct <= 120) return direct

  const fromDna = readAgeFromTravelDna(client.travel_dna)
  if (fromDna != null) return fromDna

  const fromMeta = extractAgeFromRegistrationMeta(client)
  if (fromMeta != null) return fromMeta

  if (Array.isArray(client.group_members)) {
    for (const member of client.group_members) {
      const fromMember = extractAgeFromRegistrationMeta(member)
      if (fromMember != null) return fromMember
    }
  }

  return null
}

export type TravelDnaChip = {
  key: string
  label: string
}

const TRAVEL_DNA_CHIP_MAP: Record<string, string> = {
  luxury: '💎 فاخر',
  فاخر: '💎 فاخر',
  nature: '🏔️ طبيعة',
  طبيعة: '🏔️ طبيعة',
  adventure: '🔥 مغامرة',
  مغامرة: '🔥 مغامرة',
  culture: '🏛️ ثقافة',
  ثقافة: '🏛️ ثقافة',
  food: '🍽️ مطاعم',
  مطاعم: '🍽️ مطاعم',
  shopping: '🛍️ تسوق',
  التسوق: '🛍️ تسوق',
  تسوق: '🛍️ تسوق',
  wellness: '🧘 عافية',
  سبا: '🧘 عافية',
  family: '👨‍👩‍👧 عائلة',
  عائلة: '👨‍👩‍👧 عائلة',
  history: '📜 تاريخ',
  التاريخ: '📜 تاريخ',
  تاريخ: '📜 تاريخ',
  art: '🎨 فن',
  الفن: '🎨 فن',
  فن: '🎨 فن',
  sport: '⚽ رياضة',
  الرياضة: '⚽ رياضة',
  رياضة: '⚽ رياضة',
  events: '🎉 فعاليات',
  الفعاليات: '🎉 فعاليات',
  clinics: '🏥 عيادات',
  العيادات: '🏥 عيادات',
}

export function formatSarClv(amount: number): string {
  const n = Number.isFinite(amount) ? Math.max(0, amount) : 0
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(n))} ر.س`
}

export function resolveClientLifetimeValue(
  client: Pick<VipClientProfile, 'lifetime_value' | 'total_spent'>,
): number {
  const clv = Number(client.lifetime_value)
  if (Number.isFinite(clv) && clv > 0) return clv
  const spent = Number(client.total_spent)
  if (Number.isFinite(spent) && spent > 0) return spent
  return 0
}

export function clientDisplayTierBadge(
  client: Pick<VipClientProfile, 'tier_label' | 'client_tier' | 'vip_tier'>,
): { label: string; className: string } {
  const custom = String(client.tier_label ?? '').trim()
  if (custom) {
    return {
      label: custom,
      className:
        'rounded-md border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2.5 py-1 text-xs font-bold text-[#8B7355] dark:text-[#D4AF37]',
    }
  }

  const vip = String(client.vip_tier ?? '').toLowerCase()
  if (vip === 'gold' || vip === 'ذهبي') {
    return {
      label: 'ذهبي',
      className:
        'rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]',
    }
  }
  if (vip === 'black') {
    return {
      label: 'Black',
      className:
        'rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-[#D4AF37]',
    }
  }
  if (vip === 'signature') {
    return {
      label: 'Signature',
      className:
        'rounded-md border border-[#D4AF37]/60 bg-[#001f3f] px-2.5 py-1 text-xs font-bold text-[#D4AF37]',
    }
  }

  const tier = String(client.client_tier ?? 'regular') as ClientTier
  if (tier === 'vip' || tier === 'vvip') {
    return {
      label: tier === 'vvip' ? 'VVIP' : 'VIP',
      className:
        'rounded-md border border-[#D4AF37]/50 bg-gradient-to-l from-[#d4af37]/20 to-[#e8c96a]/20 px-2.5 py-1 text-xs font-bold text-[#1c3d27] dark:text-[#D4AF37]',
    }
  }

  return {
    label: 'تقليدي',
    className:
      'rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300',
  }
}

export function normalizeEngagementStatus(raw: unknown): EngagementStatus | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'active' || s === 'نشط') return 'active'
  if (s === 'warm' || s === 'دافئ' || s === 'warm_lead') return 'warm'
  if (s === 'cold' || s === 'بارد') return 'cold'
  return null
}

export function engagementDotClass(status: EngagementStatus | null): string {
  if (status === 'active') return 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]'
  if (status === 'warm') return 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]'
  if (status === 'cold') return 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.25)]'
  return 'bg-slate-300 dark:bg-slate-600'
}

export function engagementStatusLabel(status: EngagementStatus | null): string {
  if (status === 'active') return 'نشط'
  if (status === 'warm') return 'دافئ'
  if (status === 'cold') return 'بارد'
  return '—'
}

/** Extract visual DNA chips from clients row — travel_dna, dna_* columns, dietary fallbacks */
export function parseTravelDnaChips(raw: {
  travel_dna?: unknown
  dna_interests?: string | null
  dna_activity_level?: string | null
  food_allergies?: string | null
  dietary?: string | null
  tags?: string[]
}): TravelDnaChip[] {
  const chips: TravelDnaChip[] = []
  const seen = new Set<string>()

  const push = (value: unknown, prefix = '') => {
    const key = String(value ?? '')
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    const mapped = TRAVEL_DNA_CHIP_MAP[key]
    const label =
      mapped ??
      (key.length <= 24 ? `${prefix}${String(value).trim()}` : null)
    if (!label) return
    chips.push({ key, label: mapped ? mapped : label })
  }

  const dna = raw.travel_dna
  if (Array.isArray(dna)) {
    for (const item of dna) push(item)
  } else if (dna && typeof dna === 'object') {
    const obj = dna as Record<string, unknown>
    for (const key of ['tags', 'styles', 'interests', 'chips', 'personality']) {
      const v = obj[key]
      if (Array.isArray(v)) for (const item of v) push(item)
      else if (typeof v === 'string') {
        for (const part of v.split(/[,،|/]/)) push(part)
      }
    }
    const pace = String(obj.daily_pace ?? obj.pace_preference ?? obj.pace ?? '').trim()
    if (pace) push(pace, '⚡ ')
  } else if (typeof dna === 'string' && dna.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(dna) as unknown
      if (Array.isArray(parsed)) for (const item of parsed) push(item)
    } catch {
      /* ignore */
    }
  }

  const resolved = resolveClientDnaDisplay({
    dna_interests: raw.dna_interests ?? '',
    dna_special_requests: '',
    dna_activity_level: raw.dna_activity_level ?? '',
    travel_dna: raw.travel_dna,
  })

  if (resolved.dna_interests) {
    for (const part of resolved.dna_interests.split(/[,،|/]/)) push(part)
  }

  if (resolved.dna_activity_level) {
    push(resolved.dna_activity_level, '⚡ ')
  }

  const food = String(raw.food_allergies ?? raw.dietary ?? '').trim()
  if (food) {
    for (const part of food.split(/[·,،|/]/)) {
      const trimmed = part.replace(/^مشروب:\s*/i, '').trim()
      if (trimmed) push(trimmed, '🍽️ ')
    }
  }

  if (Array.isArray(raw.tags)) {
    for (const tag of raw.tags) {
      const t = String(tag).trim()
      if (t && !t.toLowerCase().startsWith('target:')) push(t)
    }
  }

  return chips.slice(0, 8)
}

export function vipTierToDisplay(tier: VipSpendingTier): string {
  if (tier === 'gold') return 'ذهبي'
  if (tier === 'black') return 'Black'
  return 'Signature'
}
