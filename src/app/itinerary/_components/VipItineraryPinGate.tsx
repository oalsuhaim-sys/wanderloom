'use client'

import Link from 'next/link'
import { KeyRound } from 'lucide-react'

type VipItineraryPinGateProps = {
  pinInput: string
  onPinChange: (value: string) => void
  pinError: string
  onSubmit: (e: React.FormEvent) => void
  exiting?: boolean
  unlocking?: boolean
  /** جلسة منتهية — رسالة VIP خاصة */
  sessionExpired?: boolean
}

export default function VipItineraryPinGate({
  pinInput,
  onPinChange,
  pinError,
  onSubmit,
  exiting = false,
  unlocking = false,
  sessionExpired = false,
}: VipItineraryPinGateProps) {
  return (
    <div
      dir="rtl"
      className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#1E2720] px-4 font-[family-name:var(--font-tajawal),system-ui,sans-serif] transition-opacity duration-300 ease-out ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E5C158]/12 via-[#1E2720] to-[#1E2720]"
      />

      <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-6 sm:pt-8">
        <Link
          href="/"
          className="rounded-full border border-[#D4AF37]/35 bg-[#2A362C]/40 px-6 py-2 text-sm font-semibold text-[#E5C158] backdrop-blur-md transition hover:border-[#E5C158]/50"
        >
          {'\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0631\u0626\u064a\u0633\u064a'}
        </Link>
      </div>

      <div
        className={`relative z-[1] w-full max-w-md rounded-2xl border border-[#D4AF37]/25 bg-[#2A362C]/50 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl ${exiting ? '' : ''}`}
      >
        <div className="text-center">
          <h1 className="mb-2 font-serif text-4xl uppercase tracking-[0.2em] text-[#D4AF37]">Wanderloom</h1>
          <p className="text-sm font-semibold text-[#E8E4DC]/90">مسارك الخاص</p>
        </div>

        <div className="mx-auto my-7 flex max-w-xs items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/40" />
          <div className="h-1.5 w-1.5 rotate-45 bg-[#E5C158]" aria-hidden />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/40" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-center text-sm font-semibold text-[#F4F1EA]/85">
            {sessionExpired
              ? '🔒 للحفاظ على سرية معلوماتك، انتهت الجلسة. يرجى إعادة إدخال كود الـ PIN السري.'
              : 'أدخل مفتاح رحلتك الخاص'}
          </p>

          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]/60"
              aria-hidden
            />
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              value={pinInput}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="WL-1234-XX"
              className="pointer-events-auto relative z-10 w-full rounded-xl border border-[#D4AF37]/35 bg-[#2A362C]/60 py-4 pe-4 ps-11 text-center text-xl font-semibold tracking-[0.15em] text-[#E5C158] outline-none backdrop-blur-sm transition placeholder:text-[#D4AF37]/30 focus:border-[#E5C158] focus:ring-1 focus:ring-[#E5C158]/45"
              required
            />
          </div>

          {pinError ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-400/25 bg-rose-950/30 px-3 py-2 text-center text-sm font-semibold text-rose-200/95"
            >
              {pinError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={unlocking || pinInput.trim().length < 4}
            className="w-full rounded-xl bg-[#D4AF37] py-4 text-sm font-bold text-[#1E2720] transition-all duration-300 hover:bg-[#E5C158] hover:shadow-[0_0_24px_rgba(229,193,88,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unlocking
              ? '\u062c\u0627\u0631\u064d \u0627\u0644\u0641\u062a\u062d\u2026'
              : '\u0641\u062a\u062d \u0645\u0633\u0627\u0631\u064a'}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[#D4AF37]/45">
          Wanderloom &middot; Private &amp; Confidential
        </p>
      </div>
    </div>
  )
}
