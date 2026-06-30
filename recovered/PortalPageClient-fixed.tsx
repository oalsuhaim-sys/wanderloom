'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { persistItineraryUnlock } from '@/lib/itinerary-offline-cache'
import { supabase } from '@/lib/supabase'

type ItineraryPortalRow = {
  id: number | string
  magic_link_id?: string | null
  status?: string | null
}

async function lookupItineraryByPortalPin(code: string): Promise<ItineraryPortalRow | null> {
  if (!supabase) return null

  const trimmed = code.trim()
  const upper = trimmed.toUpperCase()

  const baseSelect = 'id, magic_link_id, status, passcode, pin_code'

  const byPasscode = await supabase
    .from('itineraries')
    .select(baseSelect)
    .eq('passcode', upper)
    .maybeSingle()

  if (byPasscode.data) return byPasscode.data as ItineraryPortalRow

  for (const candidate of [trimmed, upper]) {
    if (!candidate) continue
    const byPin = await supabase.from('itineraries').select(baseSelect).eq('pin_code', candidate).maybeSingle()
    if (byPin.data) return byPin.data as ItineraryPortalRow
  }

  return null
}

function itinerarySlug(row: ItineraryPortalRow): string {
  const magic = row.magic_link_id != null ? String(row.magic_link_id).trim() : ''
  if (magic) return magic
  return String(row.id)
}

export default function PortalPageClient() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const unlock = async (rawCode: string) => {
    const pin = rawCode.trim()
    if (!pin) {
      setError('يرجى إدخال مفتاح الرحلة.')
      return
    }

    setLoading(true)
    setError('')

    if (!supabase) {
      setError('قاعدة البيانات غير مهيأة. أضف مفاتيح Supabase في البيئة.')
      setLoading(false)
      return
    }

    try {
      const row = await lookupItineraryByPortalPin(pin)

      if (!row) {
        setError('الرمز غير صحيح، يرجى التأكد من مفتاح الرحلة.')
        setLoading(false)
        return
      }

      if (String(row.status || '') === 'archived') {
        setError('هذا المسار متوقف حالياً.')
        setLoading(false)
        return
      }

      const slug = itinerarySlug(row)
      persistItineraryUnlock(slug)
      router.push(`/itinerary/${encodeURIComponent(slug)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(
        msg
          ? `تعذر الاتصال بقاعدة البيانات. (${msg})`
          : 'تعذر الاتصال بقاعدة البيانات. تحقق من الشبكة وحاول مجدداً.',
      )
      setLoading(false)
    }
  }

  useEffect(() => {
    const segment = window.location.pathname.split('/').filter(Boolean).pop() ?? ''
    if (segment && segment !== 'portal' && /^WL-/i.test(segment)) {
      const normalized = segment.toUpperCase()
      setCode(normalized)
      void unlock(normalized)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      dir="rtl"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#001f3f] px-4"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#d4af37]/10 via-[#001f3f] to-[#001f3f]"
      />

      <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-6 sm:pt-8">
        <Link
          href="/"
          className="rounded-full border border-[#d4af37]/30 px-6 py-2 text-sm font-bold text-[#d4af37]/80 transition-all hover:bg-[#d4af37]/10"
        >
          العودة للموقع الرئيسي
        </Link>
      </div>

      <div className="relative z-[1] w-full max-w-sm text-center">
        <p
          className="font-[family-name:var(--font-playfair),Georgia,serif] text-5xl font-light tracking-[0.2em] text-[#d4af37] sm:text-6xl"
          aria-hidden
        >
          Wander
        </p>
        <p className="-mt-1 font-[family-name:var(--font-playfair),Georgia,serif] text-5xl font-semibold italic tracking-[0.2em] text-[#d4af37] sm:text-6xl">
          loom
        </p>

        <div className="mx-auto my-7 flex max-w-xs items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/35" />
          <div className="h-1.5 w-1.5 rotate-45 bg-[#d4af37]" aria-hidden />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/35" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void unlock(code)
          }}
          className="space-y-4"
        >
          <p className="text-sm font-medium text-white/70">أدخل مفتاح رحلتك الخاص</p>

          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d4af37]/50"
              aria-hidden
            />
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="WL-XXXX-XX"
              className="w-full rounded-xl border border-[#d4af37]/40 bg-white/5 py-4 pe-4 ps-11 text-center text-lg font-bold tracking-[0.2em] text-[#d4af37] outline-none backdrop-blur-sm transition placeholder:text-[#d4af37]/25 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50"
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-rose-300/90">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full rounded-xl bg-[#d4af37] py-4 text-sm font-bold text-[#001f3f] transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'جارٍ الفتح…' : '🔐 فتح مساري'}
          </button>
        </form>

        <p className="mt-10 text-[10px] font-medium uppercase tracking-[0.3em] text-[#d4af37]/40">
          WANDERLOOM · PRIVATE &amp; CONFIDENTIAL
        </p>
      </div>
    </div>
  )
}
