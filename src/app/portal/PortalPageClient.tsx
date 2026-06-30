'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound, Shield } from 'lucide-react'

import {
  clearWanderloomAccessKey,
  loadWanderloomAccessKey,
  persistItineraryUnlock,
  persistWanderloomAccessKey,
} from '@/lib/itinerary-offline-cache'
import { supabase } from '@/lib/supabase'

type ItineraryPortalRow = {
  id: number | string
  magic_link_id?: string | null
  status?: string | null
}

async function lookupItineraryByPasscode(passcodeInput: string): Promise<ItineraryPortalRow | null> {
  if (!supabase) return null

  const passcode = passcodeInput.trim().toUpperCase()
  if (!passcode) return null

  const { data, error } = await supabase
    .from('itineraries')
    .select('id, magic_link_id, status, passcode')
    .eq('passcode', passcode)
    .maybeSingle()

  if (error) {
    console.error('Passcode lookup error:', error)
    return null
  }

  return data ? (data as ItineraryPortalRow) : null
}

function itinerarySlug(row: ItineraryPortalRow): string {
  const magic = row.magic_link_id != null ? String(row.magic_link_id).trim() : ''
  if (magic) return magic
  return String(row.id)
}

export default function PortalPageClient() {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const unlock = async (rawCode: string, options?: { fromStorage?: boolean }) => {
    const pin = (rawCode || '').trim().toUpperCase()
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
      const row = await lookupItineraryByPasscode(pin)

      if (!row) {
        if (options?.fromStorage) clearWanderloomAccessKey()
        setError('الرمز غير صحيح، يرجى التأكد من مفتاح الرحلة.')
        setLoading(false)
        return
      }

      if (String(row.status || '') === 'archived') {
        if (options?.fromStorage) clearWanderloomAccessKey()
        setError('هذا المسار متوقف حالياً.')
        setLoading(false)
        return
      }

      const slug = itinerarySlug(row)
      persistWanderloomAccessKey(pin)
      persistItineraryUnlock(slug)
      router.push(`/itinerary/${encodeURIComponent(slug)}`)
    } catch (e) {
      if (options?.fromStorage) clearWanderloomAccessKey()
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
    const savedKey = loadWanderloomAccessKey()
    if (savedKey) {
      setPasscode(savedKey)
      void unlock(savedKey, { fromStorage: true })
      return
    }

    const segment = window.location.pathname.split('/').filter(Boolean).pop() ?? ''
    if (segment && segment !== 'portal' && /^WL-/i.test(segment)) {
      const normalized = segment.toUpperCase()
      setPasscode(normalized)
      void unlock(normalized)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      dir="rtl"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#1E2720] px-4 py-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(212,175,55,0.14),transparent_55%),radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(42,54,44,0.5),transparent)]"
      />

      <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-6 sm:pt-8">
        <Link
          href="/"
          className="rounded-full border border-[#D4AF37]/25 bg-[#2A362C]/40 px-5 py-2 text-xs font-bold text-white/80 transition-colors hover:border-[#D4AF37]/45 hover:text-[#D4AF37]"
        >
          العودة للموقع الرئيسي
        </Link>
      </div>

      <main className="relative z-[1] w-full max-w-md">
        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#2A362C]/80 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex w-full flex-col items-center text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#1E2720]/80 shadow-[0_0_24px_rgba(212,175,55,0.12)]">
              <Shield className="h-6 w-6 text-[#D4AF37]" strokeWidth={1.75} aria-hidden />
            </div>

            <h1 className="font-[family-name:var(--font-playfair),Georgia,serif] text-3xl font-semibold uppercase tracking-[0.32em] text-[#D4AF37] sm:text-4xl">
              Wanderloom
            </h1>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/55">
              Private Client Vault
            </p>
          </div>

          <div className="mb-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/35" />
            <div className="h-1 w-1 rotate-45 bg-[#D4AF37]" aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/35" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void unlock(passcode)
            }}
            className="space-y-5"
          >
            <div className="text-center">
              <p className="text-sm font-semibold text-[#D4AF37]">الوصول الآمن لمسارك</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/65">
                أدخل مفتاح الرحلة السري المُرسل إليك من فريق الكونسيرج
              </p>
            </div>

            <div className="relative z-50 mx-auto w-full max-w-sm pt-1">
              <label
                htmlFor="portal-passcode"
                className="mb-2 block text-center text-[11px] font-bold uppercase tracking-wider text-white/50"
              >
                مفتاح الرحلة
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]/55"
                  aria-hidden
                />
                <input
                  id="portal-passcode"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="WL-1234-XX"
                  className="pointer-events-auto w-full rounded-xl border border-[#D4AF37]/40 bg-white/10 p-4 ps-11 text-center text-xl font-bold tracking-[0.12em] text-white outline-none transition placeholder:text-white/35 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]"
                  autoFocus
                  required
                />
              </div>
              <p className="mt-2 text-center text-[11px] font-semibold text-white/50">
                مثال: WL-ABCD-PS
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-400/25 bg-rose-950/30 px-3 py-2 text-center text-sm font-medium text-rose-200/90">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !(passcode || '').trim()}
              className="w-full rounded-xl bg-[#D4AF37] py-4 text-sm font-bold text-[#1E2720] transition-colors hover:bg-[#C5A028] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'جارٍ التحقق…' : 'فتح الخزنة الآمنة'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.32em] text-[#D4AF37]/50">
          WANDERLOOM · PRIVATE &amp; CONFIDENTIAL
        </p>
      </main>
    </div>
  )
}
