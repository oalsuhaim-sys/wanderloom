'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'

import { PublicNavbar } from '@/app/_components/home/PublicNavbar'

const FIELD =
  'h-12 w-full rounded-2xl border border-[#1e3f20]/15 bg-white/90 px-4 text-sm font-semibold text-[#0f1e16] outline-none transition placeholder:text-gray-400 focus:border-[#cda04c] focus:ring-2 focus:ring-[#cda04c]/25'

type PartnerType = 'leader' | 'expert'

function destinationFromSearchParams(searchParams: URLSearchParams): string {
  return (
    searchParams.get('destination')?.trim() ||
    searchParams.get('destinations')?.trim() ||
    ''
  )
}

function JoinPartnerFormInner() {
  const searchParams = useSearchParams()
  const urlDestination = destinationFromSearchParams(searchParams)
  const [partnerType, setPartnerType] = useState<PartnerType>('leader')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError('')

    try {
      const form = new FormData(e.currentTarget)
      // الوجهة تُستمد من رابط الدعوة فقط — لا تُطلب من المستخدم.
      const destinations = destinationFromSearchParams(searchParams)
      const payload = {
        type: partnerType,
        partnerType,
        name: String(form.get('name') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
        experienceYears: String(form.get('experience_years') ?? '').trim(),
        languages: String(form.get('languages') ?? '').trim(),
        destinations,
        specialtyRegions: destinations,
      }

      const res = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'تعذر إرسال الطلب')
      }
      setDone(true)
      e.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[#cda04c]/30 bg-white/95 p-10 text-center shadow-2xl shadow-[#1e3f20]/10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#1e3f20]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-[#0f1e16]">تم استلام طلبك</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">
          سيظهر طلبك في رادار الشركاء بحالة قيد المراجعة، وسيتواصل معك فريق وندرلُوم قريباً.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-2xl bg-[#1e3f20] px-6 py-3 text-sm font-black text-[#cda04c]"
        >
          العودة للرئيسية
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-lg space-y-5 rounded-[2rem] border border-[#1e3f20]/10 bg-[#FDFBF7]/95 p-8 shadow-2xl shadow-[#1e3f20]/08 sm:p-10"
    >
      <div className="text-center">
        <Sparkles className="mx-auto h-7 w-7 text-[#cda04c]" aria-hidden />
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.35em] text-[#6b5c38]">
          Wanderloom Partners
        </p>
        <h1 className="mt-3 text-2xl font-black text-[#0f1e16] sm:text-3xl">
          انضم إلى شركاء Wanderloom
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">
          نبحث عن قادة رحلات وخبراء وجهات شغوفين لنسج تجارب سفر استثنائية.
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">
          نوع الشريك *
        </span>
        <select
          name="partner_type"
          required
          value={partnerType}
          onChange={(event) => setPartnerType(event.target.value as PartnerType)}
          className={FIELD}
        >
          <option value="leader">قائد رحلات 🚀</option>
          <option value="expert">خبير وجهات 🧭</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">الاسم *</span>
        <input name="name" required className={FIELD} placeholder="الاسم الكامل" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">البريد *</span>
        <input name="email" type="email" required className={FIELD} dir="ltr" placeholder="name@email.com" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">رقم الجوال *</span>
        <input name="phone" required className={FIELD} dir="ltr" placeholder="+966…" />
      </label>

      {urlDestination ? (
        <div className="rounded-2xl border border-[#cda04c]/35 bg-[#cda04c]/10 px-4 py-3 text-sm font-bold text-[#6b5c38]">
          الوجهة المرتبطة بالرابط:{' '}
          <span className="font-black text-[#1e3f20]">{urlDestination}</span>
        </div>
      ) : null}

      {partnerType === 'leader' ? (
        <>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">سنوات الخبرة *</span>
            <input
              name="experience_years"
              type="number"
              min={0}
              required
              className={FIELD}
              placeholder="مثال: 5"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1e3f20]">اللغات *</span>
            <input
              name="languages"
              required
              className={FIELD}
              placeholder="عربي، إنجليزي (مفصولة بفاصلة)"
            />
          </label>
        </>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3f20] py-3.5 text-sm font-black text-[#cda04c] shadow-lg shadow-[#1e3f20]/15 transition hover:bg-[#163018] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'جاري الإرسال…' : 'إرسال طلب الانضمام'}
      </button>
    </form>
  )
}

export default function JoinPartnerForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" aria-label="جاري التحميل" />
        </div>
      }
    >
      <JoinPartnerFormInner />
    </Suspense>
  )
}

export function JoinPartnerPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#FDFBF7] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111]"
      dir="rtl"
    >
      <PublicNavbar />
      <div className="relative isolate overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 20% 0%, rgba(205,160,76,0.22), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(30,63,32,0.12), transparent 45%)',
          }}
        />
        <div className="relative z-10 px-4 py-12 sm:py-16">{children}</div>
      </div>
    </main>
  )
}
