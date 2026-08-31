'use client'

import { Activity, MessageSquareText } from 'lucide-react'

import {
  activityLevelBadgeClass,
  parseDnaInterests,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'

type ClientDnaAdvancedDisplayProps = {
  client: Pick<VipClientProfile, 'dna_interests' | 'dna_special_requests' | 'dna_activity_level'>
  className?: string
  compact?: boolean
}

/** عرض DNA المتقدم — اهتمامات · نشاط · طلبات خاصة */
export default function ClientDnaAdvancedDisplay({
  client,
  className = '',
  compact = false,
}: ClientDnaAdvancedDisplayProps) {
  const interests = parseDnaInterests(client.dna_interests)
  const activity = client.dna_activity_level?.trim()
  const special = client.dna_special_requests?.trim()

  if (!interests.length && !activity && !special) {
    return compact ? null : (
      <p className={`text-sm text-slate-600 dark:text-slate-300 ${className}`}>
        لا توجد تفضيلات DNA متقدمة بعد.
      </p>
    )
  }

  return (
    <div
      dir="rtl"
      className={`rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-900 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-white ${className}`}
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#D4AF37]">
        <span className="inline-block select-none fill-none" aria-hidden>
          🧬
        </span>
        DNA متقدم
      </p>

      <div className="space-y-2.5">
        {interests.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              اهتمامات السفر
            </p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {activity ? (
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${activityLevelBadgeClass(activity)}`}
            >
              <Activity className="h-3 w-3 shrink-0" aria-hidden />
              {activity}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              مستوى النشاط
            </span>
          </div>
        ) : null}

        {special ? (
          <div className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 dark:border-[#2D3F3A] dark:bg-[#1A2421]/80">
            <p className="mb-1 flex items-center justify-end gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <MessageSquareText className="h-3 w-3" aria-hidden />
              طلبات خاصة
            </p>
            <p className="text-right text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {special}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
