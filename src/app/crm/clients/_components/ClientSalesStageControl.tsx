'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import {
  CLIENT_SALES_STAGES,
  normalizeSalesStage,
  salesStageBadgeClass,
  salesStageLuxuryBadgeClass,
  salesStageSelectClass,
  type ClientSalesStage,
} from '@/lib/client-sales-stage'
import { supabase } from '@/lib/supabase'

type ClientSalesStageControlProps = {
  clientId: string
  value: string
  onUpdated?: (stage: ClientSalesStage | '') => void
  compact?: boolean
  className?: string
}

export function ClientSalesStageBadge({
  stage,
  className = '',
  luxury = false,
}: {
  stage: string
  className?: string
  luxury?: boolean
}) {
  const normalized = normalizeSalesStage(stage)
  const meta = CLIENT_SALES_STAGES.find((o) => o.value === normalized)
  const tone = luxury ? salesStageLuxuryBadgeClass(stage) : salesStageBadgeClass(stage)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${tone} ${className}`}
    >
      <span aria-hidden>{meta?.emoji ?? '•'}</span>
      {meta?.shortLabel ?? (stage.trim() || 'بدون مرحلة')}
    </span>
  )
}

export default function ClientSalesStageControl({
  clientId,
  value,
  onUpdated,
  compact = false,
  className = '',
}: ClientSalesStageControlProps) {
  const [stage, setStage] = useState(normalizeSalesStage(value))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(nextRaw: string) {
    const next = normalizeSalesStage(nextRaw)
    setStage(next)
    setError('')

    if (!supabase || !clientId) return

    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('clients')
        .update({ sales_stage: next || null })
        .eq('id', clientId)

      if (err) throw err
      onUpdated?.(next)
    } catch (e) {
      setStage(normalizeSalesStage(value))
      setError(e instanceof Error ? e.message : 'تعذر تحديث مرحلة البيع')
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <div dir="rtl" className={`relative inline-flex min-w-0 max-w-full items-center ${className}`}>
        <select
          value={stage}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          aria-label="مرحلة البيع"
          title="مرحلة البيع"
          className={`${salesStageSelectClass(stage || value, 'luxury')} appearance-none pe-8 ps-3`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4af37' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left 0.65rem center',
          }}
        >
          <option value="">— مرحلة البيع —</option>
          {CLIENT_SALES_STAGES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.emoji} {opt.shortLabel}
            </option>
          ))}
        </select>
        {saving ? (
          <Loader2
            className="pointer-events-none absolute left-2 h-3 w-3 animate-spin text-[#d4af37]/80"
            aria-hidden
          />
        ) : null}
        {error ? (
          <span role="alert" className="sr-only">
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div dir="rtl" className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black text-[#001f3f]">🎯 مرحلة البيع</span>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d4af37]" aria-hidden /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ClientSalesStageBadge stage={stage || value} luxury />
        <select
          value={stage}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          aria-label="مرحلة البيع"
          className={`${salesStageSelectClass(stage || value, 'luxury')} max-w-full sm:max-w-xs`}
        >
          <option value="">— بدون مرحلة —</option>
          {CLIENT_SALES_STAGES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.emoji} {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="text-[10px] font-bold text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
