'use client'

import { Globe2, Sparkles, Users } from 'lucide-react'
import {
  resolveInfluencerContentFocus,
  resolveInfluencerFollowers,
  resolveInfluencerPlatforms,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'

type InfluencerStatsSectionProps = {
  client: Pick<
    VipClientProfile,
    | 'platforms'
    | 'content_focus'
    | 'influencer_followers'
  > & {
    platform?: string | null
    content_niche?: string | null
  }
  className?: string
}

function StatCell({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Globe2
  label: string
  value: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white/70 px-2.5 py-2 text-right ring-1 ring-stone-200/50">
      <div className="mb-1 flex items-center justify-end gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
      </div>
      <p
        className="truncate text-xs font-bold text-[#001f3f]"
        dir={dir}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

/** بيانات المؤثر داخل بطاقة العميل — تُعرض دائماً للمؤثرين */
export default function InfluencerStatsSection({ client, className = '' }: InfluencerStatsSectionProps) {
  const platforms = resolveInfluencerPlatforms(client)
  const contentFocus = resolveInfluencerContentFocus(client)
  const followers = resolveInfluencerFollowers(client)

  const platformDisplay = platforms || '---'
  const followersDisplay =
    followers > 0 ? followers.toLocaleString('ar-SA') : '---'
  const contentDisplay = contentFocus || '---'

  return (
    <div
      dir="rtl"
      className={`mt-3 rounded-xl border border-stone-200/70 bg-gradient-to-bl from-slate-100/80 via-[#FAFAF8] to-white p-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-end gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">🌟 بيانات المؤثر</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCell icon={Globe2} label="المنصة" value={platformDisplay} />
        <StatCell icon={Users} label="المتابعين" value={followersDisplay} dir="ltr" />
        <StatCell icon={Sparkles} label="المحتوى" value={contentDisplay} />
      </div>
    </div>
  )
}
