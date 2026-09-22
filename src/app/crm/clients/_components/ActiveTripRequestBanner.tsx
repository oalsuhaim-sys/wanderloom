'use client'

import type { ReactNode } from 'react'
import { Loader2, Plane, Sparkles } from 'lucide-react'

import { salesStageShortLabel } from '@/lib/client-sales-stage'
import { formatTravelDateArabic, joinDestinations } from '@/lib/crm-leads'

export type ActiveTripRequest = {
  destination: string
  travelDate: string
  durationDays: number | null
  passengersCount: number | null
  statusLabel: string
}

/** Local calendar YYYY-MM-DD (no UTC shift). */
export function todayIsoLocal(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Active when travel_date is today or in the future; expired dates auto-hide. */
export function isActiveTravelDate(travelDateRaw: unknown, now = new Date()): boolean {
  const iso = String(travelDateRaw ?? '')
    .trim()
    .slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return iso >= todayIsoLocal(now)
}

export function resolveActiveTripRequestFromLead(
  lead: Record<string, unknown> | null | undefined,
  opts?: { salesStage?: string | null; targetTrip?: string | null },
): ActiveTripRequest | null {
  if (!lead || !isActiveTravelDate(lead.travel_date)) return null

  const travelDate = String(lead.travel_date).trim().slice(0, 10)
  const dests = Array.isArray(lead.destinations)
    ? (lead.destinations as unknown[]).map((d) => String(d ?? '').trim()).filter(Boolean)
    : []
  const target = String(opts?.targetTrip ?? '').trim()
  const destination =
    (dests.length ? joinDestinations(dests) : '') ||
    target ||
    'وجهة قيد التحديد'

  const daysRaw = Number(lead.travel_days)
  const paxRaw = Number(lead.travelers_count)
  const stage = String(opts?.salesStage ?? lead.status ?? '').trim()
  const short = salesStageShortLabel(stage)
  const statusLabel = short || stage || 'طلب نشط'

  return {
    destination,
    travelDate,
    durationDays: Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : null,
    passengersCount: Number.isFinite(paxRaw) && paxRaw > 0 ? Math.floor(paxRaw) : null,
    statusLabel,
  }
}

type ActiveTripRequestBannerProps = {
  request: ActiveTripRequest
  className?: string
  /** Optional CTA (e.g. Claude proposal generate). */
  action?: ReactNode
  onGenerateClaude?: () => void
  generatingClaude?: boolean
}

/**
 * Dark slate active-request bar — auto-hidden by caller when travel_date has passed.
 */
export default function ActiveTripRequestBanner({
  request,
  className = '',
  action,
  onGenerateClaude,
  generatingClaude = false,
}: ActiveTripRequestBannerProps) {
  const dateLabel = formatTravelDateArabic(request.travelDate)
  const parts = [
    request.destination,
    dateLabel !== '—' ? dateLabel : request.travelDate,
    request.durationDays != null ? `${request.durationDays} يوم` : null,
    request.passengersCount != null ? `${request.passengersCount} مسافر` : null,
  ].filter(Boolean)

  const claudeButton =
    onGenerateClaude != null ? (
      <button
        type="button"
        onClick={onGenerateClaude}
        disabled={generatingClaude}
        title="توليد عرض سعر كامل بواسطة Claude AI من DNA وتواريخ الرحلة"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/50 bg-amber-300/15 px-2.5 py-1.5 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/25 disabled:opacity-60 sm:text-xs"
      >
        {generatingClaude ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
        )}
        {generatingClaude ? 'Claude يكتب العرض…' : 'توليد عرض السعر بواسطة Claude AI'}
      </button>
    ) : null

  return (
    <div
      dir="rtl"
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-700/80 px-3 py-3 text-amber-300 shadow-sm dark:bg-[#1A2421]/90 dark:ring-1 dark:ring-[#D4AF37]/25 ${className}`}
      role="status"
      aria-label="طلب رحلة نشط"
    >
      <Plane className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
      <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300/70 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-amber-200">
        {request.statusLabel}
      </span>
      <p className="min-w-0 flex-1 text-right text-xs font-bold leading-relaxed text-amber-100 sm:text-sm">
        <span className="text-amber-300">طلب الرحلة:</span> {parts.join(' · ')}
      </p>
      {action ?? claudeButton}
    </div>
  )
}
