'use client'

import { Activity, MessageSquareText, Sparkles } from 'lucide-react'

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
      <p className={`text-[11px] font-semibold text-slate-400 ${className}`}>
        لا توجد تفضيلات DNA متقدمة بعد.
      </p>
    )
  }

  return (
    <div
      dir="rtl"
      className={`rounded-xl border border-[#d4af37]/15 bg-gradient-to-bl from-[#FAFAF8] via-white to-[#FEFDF9] p-3 ${className}`}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#cda04c]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        DNA متقدم
      </p>

      <div className="space-y-2.5">
        {interests.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-bold text-slate-400">اهتمامات السفر</p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#001f3f]/12 bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#001f3f]"
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
            <span className="text-[10px] font-bold text-slate-400">مستوى النشاط</span>
          </div>
        ) : null}

        {special ? (
          <div className="rounded-lg border border-stone-100 bg-white/80 px-2.5 py-2">
            <p className="mb-1 flex items-center justify-end gap-1 text-[10px] font-bold text-slate-400">
              <MessageSquareText className="h-3 w-3" aria-hidden />
              طلبات خاصة
            </p>
            <p className="text-right text-xs font-semibold leading-relaxed text-slate-700">{special}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
