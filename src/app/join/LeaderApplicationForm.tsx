'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Send, Sparkles } from 'lucide-react'

import { submitLeaderApplication, type LeaderApplicationState } from '@/app/actions/submitLeaderApplication'
import ClientDnaAdvancedFieldsEditor from '@/app/crm/clients/_components/ClientDnaAdvancedFieldsEditor'
import {
  normalizeAffiliateRef,
  persistAffiliateRef,
  readPersistedAffiliateRef,
} from '@/lib/referral-url'

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-gray-200/90 bg-white/80 px-4 text-sm font-bold text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#cda04c]/70 focus:ring-2 focus:ring-[#cda04c]/25'

const FIELD_LABEL = 'mb-1.5 block text-right text-xs font-black tracking-wide text-[#cda04c]'

const DNA_FIELD =
  'w-full rounded-xl border border-gray-200/90 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1e3f20]/40 focus:ring-2 focus:ring-[#cda04c]/25 [color-scheme:light]'

function LeaderApplicationFormInner() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<LeaderApplicationState | null>(null)
  const [pending, startTransition] = useTransition()
  const [leaderCode, setLeaderCode] = useState('')
  const [dna, setDna] = useState({
    dna_interests: '',
    dna_special_requests: '',
    dna_activity_level: '',
  })

  useEffect(() => {
    const fromUrl = normalizeAffiliateRef(searchParams.get('ref'))
    if (fromUrl) {
      persistAffiliateRef(fromUrl)
      setLeaderCode(fromUrl)
      return
    }
    const stored = readPersistedAffiliateRef()
    if (stored) setLeaderCode(stored)
  }, [searchParams])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const ref = normalizeAffiliateRef(leaderCode) || normalizeAffiliateRef(fd.get('leader_code') as string)
    if (ref) fd.set('leader_code', ref)
    fd.set('dna_interests', dna.dna_interests)
    fd.set('dna_special_requests', dna.dna_special_requests)
    fd.set('dna_activity_level', dna.dna_activity_level)

    setState(null)
    startTransition(() => {
      void (async () => {
        const result = await submitLeaderApplication(fd)
        setState(result)
        if (result.ok) form.reset()
      })()
    })
  }

  if (!leaderCode) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-[#1e3f20]/10 bg-white/90 p-8 text-center shadow-xl backdrop-blur-sm">
        <Sparkles className="mx-auto h-10 w-10 text-[#cda04c]" aria-hidden />
        <h1 className="mt-4 text-xl font-black text-[#0f1e16]">دعوة حصرية فقط</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-gray-600">
          هذه الصفحة مخصّصة للانضمام عبر شركاء وندرلُوم. استخدم رابط أو باركود الدعوة الذي
          استلمته.
        </p>
      </div>
    )
  }

  if (state?.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-emerald-200 bg-emerald-50/90 p-8 text-center shadow-xl">
        <p className="text-3xl" aria-hidden>
          ✨
        </p>
        <h1 className="mt-3 text-xl font-black text-emerald-950">تم إرسال طلبك</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-emerald-900">{state.message}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-[#1e3f20]/10 bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-8"
    >
      <div className="border-b border-gray-100 pb-5 text-center">
        <p className="text-[10px] font-black tracking-[0.35em] text-[#6b5c38]">WANDERLOOM EXCLUSIVE</p>
        <h1 className="mt-2 text-2xl font-black text-[#0f1e16] sm:text-3xl">طلب انضمام VIP</h1>
        <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600">
          نموذج تقديم حصري عبر شريك وندرلُوم. املأ بياناتك وDNA السفر لنبدأ تصميم تجربتك.
        </p>
      </div>

      <input type="hidden" name="leader_code" value={leaderCode} />

      {state?.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={FIELD_LABEL}>الاسم الكامل *</span>
          <input name="name" required className={INPUT_CLASS} dir="rtl" placeholder="اسمك كما في الجواز" />
        </label>
        <label className="block">
          <span className={FIELD_LABEL}>رقم الجوال (واتساب) *</span>
          <input
            name="phone_wa"
            required
            type="tel"
            className={INPUT_CLASS}
            dir="ltr"
            placeholder="+966…"
          />
        </label>
        <label className="block">
          <span className={FIELD_LABEL}>البريد الإلكتروني</span>
          <input name="email" type="email" className={INPUT_CLASS} dir="ltr" placeholder="email@…" />
        </label>
      </div>

      <ClientDnaAdvancedFieldsEditor value={dna} onChange={setDna} fieldClassName={DNA_FIELD} />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3f20] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#1e3f20]/20 transition hover:bg-[#163018] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            جاري الإرسال…
          </>
        ) : (
          <>
            <Send className="h-5 w-5" aria-hidden />
            إرسال طلب الانضمام
          </>
        )}
      </button>
    </form>
  )
}

export default function LeaderApplicationForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" aria-label="جاري التحميل" />
        </div>
      }
    >
      <LeaderApplicationFormInner />
    </Suspense>
  )
}
