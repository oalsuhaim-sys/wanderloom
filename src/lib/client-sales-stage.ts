/** مراحل مسار البيع High-Ticket — جدول clients.sales_stage */

export const SALES_STAGE_NEW = 'طلب انضمام جديد' as const
export const SALES_STAGE_INTERVIEW = 'تم تحديد مقابلة' as const
export const SALES_STAGE_PENDING_PAYMENT = 'بانتظار الدفع (ساعتين)' as const
export const SALES_STAGE_CONFIRMED = 'عميل مؤكد' as const
export const SALES_STAGE_ACTIVE_TRAVELER = 'مسافر نشط' as const

export type ClientSalesStage =
  | typeof SALES_STAGE_NEW
  | typeof SALES_STAGE_INTERVIEW
  | typeof SALES_STAGE_PENDING_PAYMENT
  | typeof SALES_STAGE_CONFIRMED
  | typeof SALES_STAGE_ACTIVE_TRAVELER

export const CLIENT_SALES_STAGES: {
  value: ClientSalesStage
  label: string
  shortLabel: string
  emoji: string
}[] = [
  { value: SALES_STAGE_NEW, label: SALES_STAGE_NEW, shortLabel: 'طلب جديد', emoji: '📝' },
  { value: SALES_STAGE_INTERVIEW, label: SALES_STAGE_INTERVIEW, shortLabel: 'مقابلة', emoji: '📅' },
  {
    value: SALES_STAGE_PENDING_PAYMENT,
    label: SALES_STAGE_PENDING_PAYMENT,
    shortLabel: 'بانتظار الدفع',
    emoji: '⏳',
  },
  { value: SALES_STAGE_CONFIRMED, label: SALES_STAGE_CONFIRMED, shortLabel: 'مؤكد', emoji: '✅' },
  {
    value: SALES_STAGE_ACTIVE_TRAVELER,
    label: SALES_STAGE_ACTIVE_TRAVELER,
    shortLabel: 'مسافر نشط',
    emoji: '✈️',
  },
]

export const DEFAULT_SALES_STAGE: ClientSalesStage = SALES_STAGE_NEW

export function normalizeSalesStage(raw: unknown): ClientSalesStage | '' {
  const s = String(raw ?? '').trim()
  if (CLIENT_SALES_STAGES.some((o) => o.value === s)) return s as ClientSalesStage
  return ''
}

export function salesStageBadgeClass(stage: string): string {
  const s = normalizeSalesStage(stage)
  switch (s) {
    case SALES_STAGE_NEW:
      return 'border-amber-300/70 bg-amber-50 text-amber-950 ring-1 ring-amber-200/80'
    case SALES_STAGE_INTERVIEW:
      return 'border-sky-300/70 bg-sky-50 text-sky-950 ring-1 ring-sky-200/80'
    case SALES_STAGE_PENDING_PAYMENT:
      return 'border-orange-400/70 bg-orange-50 text-orange-950 ring-1 ring-orange-300/80'
    case SALES_STAGE_CONFIRMED:
      return 'border-emerald-300/70 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80'
    case SALES_STAGE_ACTIVE_TRAVELER:
      return 'border-violet-300/70 bg-violet-50 text-violet-950 ring-1 ring-violet-200/80'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600 ring-1 ring-slate-100'
  }
}

export function salesStageSelectClass(stage: string, variant: 'light' | 'luxury' = 'light'): string {
  if (variant === 'luxury') {
    return `h-8 min-w-0 max-w-[11.5rem] shrink rounded-full border border-gray-700/90 bg-[#001f3f] px-3 py-0 text-[11px] font-bold text-[#d4af37]/90 outline-none transition focus:border-[#d4af37]/50 focus:ring-2 focus:ring-[#d4af37]/25 [color-scheme:dark] ${stage ? '' : 'text-[#d4af37]/60'}`
  }

  const base =
    'w-full rounded-xl border px-3 py-2.5 text-xs font-black outline-none transition focus:ring-2 focus:ring-[#d4af37]/45 [color-scheme:light]'
  return `${base} ${salesStageBadgeClass(stage)}`
}

export function salesStageLuxuryBadgeClass(stage: string): string {
  const s = normalizeSalesStage(stage)
  switch (s) {
    case SALES_STAGE_NEW:
      return 'border-amber-500/40 bg-amber-950/40 text-amber-200/95'
    case SALES_STAGE_INTERVIEW:
      return 'border-sky-500/40 bg-sky-950/40 text-sky-200/95'
    case SALES_STAGE_PENDING_PAYMENT:
      return 'border-orange-500/45 bg-orange-950/40 text-orange-200/95'
    case SALES_STAGE_CONFIRMED:
      return 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200/95'
    case SALES_STAGE_ACTIVE_TRAVELER:
      return 'border-violet-500/40 bg-violet-950/40 text-violet-200/95'
    default:
      return 'border-gray-600/80 bg-gray-800 text-[#d4af37]/75'
  }
}
