'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Sparkles } from 'lucide-react'

import {
  getVaultCountdownParts,
  getVaultUnlockAt,
  type VaultCountdownParts,
} from '@/lib/vip-vault-reveal'

type VipVaultCountdownProps = {
  startDate: string | null
  destination?: string
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center rounded-2xl border border-[#D4AF37]/35 bg-white px-3 py-4 shadow-sm sm:min-w-[5.5rem] sm:px-4">
      <span
        className="text-3xl font-black tabular-nums text-[#1E2720] sm:text-4xl"
        dir="ltr"
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#1E2720]/50 sm:text-[11px]">
        {label}
      </span>
    </div>
  )
}

export default function VipVaultCountdown({ startDate, destination }: VipVaultCountdownProps) {
  const unlockAt = getVaultUnlockAt(startDate)

  const [parts, setParts] = useState<VaultCountdownParts>(() =>
    unlockAt
      ? getVaultCountdownParts(unlockAt)
      : { days: 0, hours: 0, minutes: 0, totalMs: 0 },
  )

  useEffect(() => {
    if (!unlockAt) return
    const tick = () => setParts(getVaultCountdownParts(unlockAt))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [unlockAt?.getTime()])

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-b from-white via-[#FAFAFA] to-[#F5F3EE] px-6 py-10 text-center shadow-[0_12px_40px_rgba(30,39,32,0.08)]"
      aria-labelledby="vip-vault-heading"
    >
      <div
        className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#D4AF37]/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-[#1E2720]/5 blur-2xl"
        aria-hidden
      />

      <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#D4AF37]/50 bg-[#D4AF37]/10">
        <KeyRound className="h-7 w-7 text-[#D4AF37]" aria-hidden />
      </div>

      <p className="relative text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">
        VIP Vault
      </p>
      <h2 id="vip-vault-heading" className="relative mt-2 text-xl font-black leading-snug text-[#1E2720] sm:text-2xl">
        رحلتك الاستثنائية قيد التجهيز
      </h2>
      <p className="relative mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-[#1E2720]/60">
        Your exceptional journey is being prepared. يُفتح برنامجك اليومي قبل انطلاق الرحلة بـ 24
        ساعة — حتى تبقى كل مفاجأة حصرية لك.
      </p>

      {destination ? (
        <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#1E2720]/10 bg-white px-4 py-1.5 text-xs font-bold text-[#1E2720]/70">
          <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          {destination}
        </p>
      ) : null}

      {unlockAt && parts.totalMs > 0 ? (
        <div className="relative mt-8">
          <p className="mb-4 text-xs font-bold text-[#1E2720]/45">يفتح البرنامج خلال</p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <CountdownUnit value={parts.days} label="يوم" />
            <CountdownUnit value={parts.hours} label="ساعة" />
            <CountdownUnit value={parts.minutes} label="دقيقة" />
          </div>
        </div>
      ) : (
        <p className="relative mt-6 text-sm font-semibold text-[#D4AF37]">
          سيُعلَن موعد الفتح قريباً — تواصل مع الكونسيرج عند الحاجة.
        </p>
      )}

      <div className="relative mx-auto mt-8 h-px max-w-xs bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
      <p className="relative mt-4 text-[11px] font-medium text-[#1E2720]/40">
        تبويب الحجوزات متاح دائماً لوثائق المطار والفنادق الرسمية
      </p>
    </section>
  )
}
