'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'

import {
  PUBLIC_PARTNER_KIND_LABELS,
  PUBLIC_PARTNER_KINDS,
} from '@/lib/partners'

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-gray-200/90 bg-white px-4 text-sm font-semibold text-gray-900 outline-none focus:border-[#cda04c]/70 focus:ring-2 focus:ring-[#cda04c]/25'

export default function JoinLeaderForm() {
  const searchParams = useSearchParams()
  const urlDestination =
    searchParams.get('destination')?.trim() ||
    searchParams.get('destinations')?.trim() ||
    ''
  const [partnerKind, setPartnerKind] = useState<'leader' | 'expert'>('leader')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError('')

    try {
      const formData = new FormData(e.currentTarget)
      formData.set('partner_kind', partnerKind)
      if (urlDestination) {
        formData.set('preferred_destinations', urlDestination)
      }

      const res = await fetch('/api/join-leader', {
        method: 'POST',
        body: formData,
      })
      const payload = (await res.json()) as { ok?: boolean; error?: string; message?: string }

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر إرسال الطلب')
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
      <div className="mx-auto max-w-lg rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h1 className="text-xl font-black text-emerald-900">تم استلام طلبك</h1>
        <p className="mt-3 text-sm font-semibold text-emerald-800">
          سيراجعه فريق وندرلُوم ويتواصل معك قريباً.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-lg space-y-4 rounded-3xl border border-[#1e3f20]/10 bg-white p-8 shadow-xl"
    >
      <h1 className="text-center text-2xl font-black text-[#1e3f20]">انضم كشريك</h1>
      <p className="text-center text-sm font-semibold leading-relaxed text-gray-600">
        نبحث عن قادة رحلات وخبراء وجهات شغوفين لنسج تجارب سفر استثنائية.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">نوع الشراكة</span>
        <select
          value={partnerKind}
          onChange={(e) => setPartnerKind(e.target.value as 'leader' | 'expert')}
          className={INPUT_CLASS}
        >
          {PUBLIC_PARTNER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PUBLIC_PARTNER_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">الاسم الكامل *</span>
        <input name="name" required className={INPUT_CLASS} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">رقم الجوال *</span>
        <input name="phone" required className={INPUT_CLASS} dir="ltr" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">البريد الإلكتروني</span>
        <input name="email" type="email" className={INPUT_CLASS} dir="ltr" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">اللغات</span>
        <input name="languages" placeholder="عربي، إنجليزي…" className={INPUT_CLASS} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">سنوات الخبرة</span>
        <input name="experience_years" type="number" min={0} className={INPUT_CLASS} />
      </label>

      {urlDestination ? (
        <div className="rounded-xl border border-[#cda04c]/30 bg-[#cda04c]/10 px-4 py-3 text-sm font-bold text-[#6b5c38]">
          الوجهة المرتبطة بالرابط:{' '}
          <span className="font-black text-[#1e3f20]">{urlDestination}</span>
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-gray-700">نبذة</span>
        <textarea name="bio" rows={3} className={`${INPUT_CLASS} h-auto py-3`} />
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3f20] py-3 text-sm font-black text-[#cda04c] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        إرسال الطلب
      </button>
    </form>
  )
}
