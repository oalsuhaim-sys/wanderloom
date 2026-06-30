'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Bell, Calendar, MapPin, Plane } from 'lucide-react'

import {
  fetchPublicItinerary,
  formatTripDateRange,
  googleMapsSearchUrl,
  type PublicItinerary,
} from '@/lib/public-itinerary'

const WA_CONCIERGE = '966544948640'
const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop'

const EM_DASH = '\u2014'
const ARROW = '\u2190'
const ELLIPSIS = '\u2026'

function waUrl(text: string) {
  return `https://wa.me/${WA_CONCIERGE}?text=${encodeURIComponent(text)}`
}

function flightLine(fd: Record<string, unknown> | null, key: string): string {
  if (!fd) return ''
  const v = fd[key]
  return v != null && String(v).trim() ? String(v).trim() : ''
}

function displayRouteCode(city: string): string {
  const t = city.trim()
  if (!t) return EM_DASH
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase()
  const paren = /\(([A-Za-z]{3})\)/.exec(t)
  if (paren) return paren[1].toUpperCase()
  const latin = t.match(/\b([A-Za-z]{3})\b/)
  if (latin) return latin[1].toUpperCase()
  if (t.length <= 8) return t.toUpperCase()
  return t.slice(0, 10)
}

function hasFlightBoardingData(fd: Record<string, unknown> | null): boolean {
  if (!fd) return false
  return Boolean(
    flightLine(fd, 'from_city') ||
      flightLine(fd, 'to_city') ||
      flightLine(fd, 'flight_number') ||
      flightLine(fd, 'airport') ||
      flightLine(fd, 'terminal') ||
      flightLine(fd, 'leave_home_time') ||
      flightLine(fd, 'departure_time') ||
      flightLine(fd, 'gate') ||
      flightLine(fd, 'seat'),
  )
}

function BoardingPassBarcode() {
  const widths = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1]
  return (
    <div
      className="flex h-14 items-end justify-center gap-[2px] opacity-75"
      aria-hidden
    >
      {widths.map((w, i) => (
        <div
          key={i}
          className="rounded-[1px] bg-gradient-to-b from-[#d4af37]/90 to-white/70"
          style={{ width: w, height: `${55 + (i % 5) * 8}%` }}
        />
      ))}
    </div>
  )
}

function BoardingPassCard({ fd }: { fd: Record<string, unknown> }) {
  const from = flightLine(fd, 'from_city')
  const to = flightLine(fd, 'to_city')
  const fromCode = displayRouteCode(from || EM_DASH)
  const toCode = displayRouteCode(to || EM_DASH)
  const flightNo = flightLine(fd, 'flight_number') || EM_DASH
  const gate =
    flightLine(fd, 'gate') || flightLine(fd, 'terminal') || flightLine(fd, 'airport') || EM_DASH
  const seat = flightLine(fd, 'seat') || EM_DASH
  const boarding =
    flightLine(fd, 'boarding_time') ||
    flightLine(fd, 'departure_time') ||
    flightLine(fd, 'leave_home_time') ||
    EM_DASH

  return (
    <section className="relative z-10 -mt-6 mb-8 overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#001f3f]/55 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/8 via-transparent to-[#002a55]/40" />
      <div className="relative flex flex-row overflow-hidden">
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-[#d4af37]">
              <Plane className="h-4 w-4 shrink-0" aria-hidden />
              تفاصيل الطيران
            </div>
            <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#d4af37]/90">
              VIP
            </span>
          </div>

          <p
            className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl"
            dir="ltr"
          >
            <span className="text-[#d4af37]">{fromCode}</span>
            <span className="mx-2 inline-block text-white/40" aria-hidden>
              {'\u2708\uFE0F'}
            </span>
            <span className="text-[#d4af37]">{toCode}</span>
          </p>
          {(from || to) && (fromCode !== from || toCode !== to) ? (
            <p className="mt-1 text-center text-[11px] font-medium text-white/45">
              {[from, to].filter(Boolean).join(` ${ARROW} `)}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                Flight No
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#d4af37]" dir="ltr">
                {flightNo}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Gate</p>
              <p className="mt-0.5 text-sm font-bold text-white">{gate}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Seat</p>
              <p className="mt-0.5 text-sm font-bold text-white">{seat}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                Boarding
              </p>
              <p className="mt-0.5 text-sm font-bold text-white" dir="ltr">
                {boarding}
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-between border-s border-dashed border-white/20 bg-[#00152e]/50 px-2 py-4 sm:w-20">
          <p
            className="text-[8px] font-black uppercase tracking-widest text-[#d4af37]/70 [writing-mode:vertical-rl]"
            style={{ transform: 'rotate(180deg)' }}
          >
            WANDERLOOM
          </p>
          <BoardingPassBarcode />
          <p className="font-mono text-[9px] font-bold text-white/50 [writing-mode:vertical-rl]" dir="ltr">
            {flightNo !== EM_DASH ? flightNo.slice(0, 8) : 'VIP'}
          </p>
        </div>
      </div>
    </section>
  )
}

type PublicVipItineraryViewProps = {
  slug?: string
}

export default function PublicVipItineraryView({ slug: slugProp }: PublicVipItineraryViewProps = {}) {
  const params = useParams<{ id: string }>()
  const slug = String(slugProp ?? params?.id ?? '').trim()

  const [trip, setTrip] = useState<PublicItinerary | null>(null)
  const [pinRequired, setPinRequired] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { trip: loaded, pinCode } = await fetchPublicItinerary(slug)
      if (cancelled) return
      if (!loaded) {
        setTrip(null)
        setLoading(false)
        return
      }
      setTrip(loaded)
      if (!loaded.hasPin || !pinCode) {
        setAuthenticated(true)
        setPinRequired(null)
      } else {
        setPinRequired(pinCode)
        setAuthenticated(false)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const handlePin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === pinRequired) {
      setAuthenticated(true)
      setPinError('')
    } else {
      setPinError('\u0627\u0644\u0631\u0645\u0632 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.')
    }
  }

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] items-center justify-center bg-[#001f3f] font-sans text-[#d4af37]"
      >
        <p className="animate-pulse text-sm font-semibold tracking-wide">
          {'\u062c\u0627\u0631\u064a \u062a\u062c\u0647\u064a\u0632 \u0631\u062d\u0644\u062a\u0643' + ELLIPSIS}
        </p>
      </div>
    )
  }

  if (!trip) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] items-center justify-center bg-[#001f3f] px-6 text-center font-sans text-rose-200"
      >
        <p className="text-sm font-semibold">
          {'\u0627\u0644\u0631\u0627\u0628\u0637 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0627\u0646\u062a\u0647\u062a \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0631\u062d\u0644\u0629.'}
        </p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] items-center justify-center bg-[#001f3f] px-4 font-sans"
      >
        <form
          onSubmit={handlePin}
          className="w-full max-w-sm rounded-3xl border border-[#d4af37]/30 bg-[#002a55]/90 p-8 text-center shadow-2xl"
        >
          <p className="mb-2 text-4xl" aria-hidden>
            {'\uD83D\uDD12'}
          </p>
          <h1 className="text-xl font-black text-[#d4af37]">
            {'\u0631\u062d\u0644\u0629 \u0645\u062d\u0645\u064a\u0629'}
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {'\u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0633\u0631\u064a \u0627\u0644\u0645\u0643\u0648\u0651\u0646 \u0645\u0646 4 \u0623\u0631\u0642\u0627\u0645'}
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="mt-6 w-full rounded-2xl border border-[#d4af37]/35 bg-[#001f3f] px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-[#d4af37]/50"
            required
          />
          {pinError ? <p className="mt-3 text-sm text-rose-300">{pinError}</p> : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-2xl bg-[#d4af37] py-3.5 text-sm font-black text-[#001f3f] transition hover:brightness-110"
          >
            {'\u0641\u062a\u062d \u0627\u0644\u0631\u062d\u0644\u0629'}
          </button>
        </form>
      </div>
    )
  }

  const dateRange = formatTripDateRange(trip.startDate, trip.endDate)
  const fd = trip.flightDetails
  const conciergeText = `\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u0646\u0627 ${trip.customerName}\u060c \u0623\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0628\u062e\u0635\u0648\u0635 \u0631\u062d\u0644\u062a\u064a \u0625\u0644\u0649 ${trip.destination}.`

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#001f3f] pb-28 font-sans text-white">
      <header className="relative min-h-[42vh] overflow-hidden">
        <img
          src={trip.coverImage || DEFAULT_HERO}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001f3f] via-[#001f3f]/75 to-[#001f3f]/40" />
        <div className="relative flex min-h-[42vh] flex-col justify-end px-5 pb-10 pt-16 sm:px-8">
          <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#d4af37]">
            Wanderloom VIP
          </span>
          <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">{trip.title}</h1>
          <p className="mt-2 text-lg font-bold text-[#d4af37]">{trip.destination}</p>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-white/80">
            <Calendar className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
            {dateRange}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {'\u0645\u0631\u062d\u0628\u0627\u064b\u060c'} {trip.customerName}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 sm:max-w-xl sm:px-6">
        {hasFlightBoardingData(fd) ? <BoardingPassCard fd={fd!} /> : null}

        {trip.highlights.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-[#d4af37]">
              {'\u0623\u0628\u0631\u0632 \u0627\u0644\u0644\u062d\u0638\u0627\u062a'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {trip.highlights.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-[#d4af37]/30 bg-[#002a55] px-3 py-1.5 text-xs font-bold text-white/90"
                >
                  {h}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-5 text-center text-xl font-black text-[#d4af37]">
            {'\u0628\u0631\u0646\u0627\u0645\u062c \u0627\u0644\u0631\u062d\u0644\u0629 \u0627\u0644\u064a\u0648\u0645\u064a'}
          </h2>
          <div className="space-y-4">
            {trip.days.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-[#002a55]/60 py-10 text-center text-sm text-white/60">
                {'\u062c\u0627\u0631\u064a \u062a\u0646\u0633\u064a\u0642 \u062a\u0641\u0627\u0635\u064a\u0644 \u0623\u064a\u0627\u0645 \u0631\u062d\u0644\u062a\u0643' + ELLIPSIS}
              </p>
            ) : (
              trip.days.map((day) => (
                <article
                  key={`day-${day.index}`}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-md transition hover:shadow-lg"
                >
                  <div className="border-b border-[#d4af37]/20 bg-gradient-to-l from-[#001f3f] to-[#002a55] px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]/80">
                      {'\u0627\u0644\u064a\u0648\u0645'} {day.index + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">{day.title}</h3>
                    {day.dateLabel ? (
                      <p className="mt-1 text-xs font-semibold text-white/60">{day.dateLabel}</p>
                    ) : null}
                  </div>
                  <div className="px-5 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#001f3f]/90">
                      {day.body || '\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 \u0642\u0631\u064a\u0628\u0627\u064b' + ELLIPSIS}
                    </p>
                    <a
                      href={googleMapsSearchUrl(day.mapsQuery)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#001f3f]/15 bg-[#001f3f]/5 py-3 text-sm font-bold text-[#001f3f] transition hover:bg-[#001f3f]/10"
                    >
                      <MapPin className="h-4 w-4 text-[#d4af37]" aria-hidden />
                      {'\u0641\u062a\u062d \u0641\u064a \u062e\u0631\u0627\u0626\u0637 Google'}
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <a
          href={googleMapsSearchUrl(trip.destination)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-[#d4af37]/35 bg-[#002a55] py-4 text-sm font-black text-[#d4af37] transition hover:bg-[#003366]"
        >
          <MapPin className="h-5 w-5 shrink-0" aria-hidden />
          {'\u0627\u0633\u062a\u0643\u0634\u0641'} {trip.destination} {'\u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629'}
        </a>
      </main>

      <a
        href={waUrl(conciergeText)}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border border-[#d4af37]/50 bg-[#d4af37] px-5 py-3.5 text-sm font-black text-[#001f3f] shadow-[0_0_15px_rgba(212,175,55,0.4)] transition hover:scale-[1.03] hover:shadow-[0_0_22px_rgba(212,175,55,0.55)] active:scale-[0.98] sm:bottom-8 sm:right-8"
        aria-label={'\u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0627\u0644\u0634\u062e\u0635\u064a \u2014 \u0648\u0627\u062a\u0633\u0627\u0628'}
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.25} />
        <span>{'\u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0627\u0644\u0634\u062e\u0635\u064a'}</span>
      </a>
    </div>
  )
}
