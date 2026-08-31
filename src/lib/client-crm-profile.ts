import type { ClientTier, VipClientProfile } from '@/lib/clientsTravelDna'
import type { VipSpendingTier } from '@/lib/vip-spending-tier'

export type EngagementStatus = 'active' | 'warm' | 'cold'

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

/** Extract visual DNA chips from travel_dna (array or object) + dna_interests — no invented tags */
export function parseTravelDnaChips(raw: {
  travel_dna?: unknown
  dna_interests?: string | null
  tags?: string[]
}): TravelDnaChip[] {
  const chips: TravelDnaChip[] = []
  const seen = new Set<string>()

  const push = (value: unknown) => {
    const key = String(value ?? '')
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    const mapped = TRAVEL_DNA_CHIP_MAP[key]
    const label =
      mapped ??
      (key.length <= 24 ? String(value).trim() : null)
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
  } else if (typeof dna === 'string' && dna.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(dna) as unknown
      if (Array.isArray(parsed)) for (const item of parsed) push(item)
    } catch {
      /* ignore */
    }
  }

  if (raw.dna_interests) {
    for (const part of String(raw.dna_interests).split(/[,،|/]/)) push(part)
  }

  return chips.slice(0, 8)
}

export function vipTierToDisplay(tier: VipSpendingTier): string {
  if (tier === 'gold') return 'ذهبي'
  if (tier === 'black') return 'Black'
  return 'Signature'
}
