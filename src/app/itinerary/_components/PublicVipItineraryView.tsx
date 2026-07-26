'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  CloudSun,
  Copy,
  Key,
  MapPin,
  MessageCircle,
  Plane,
} from 'lucide-react'

import VipMedicalConciergeBanner, {
  filterNonMedicalPreTripServices,
} from './VipMedicalConciergeBanner'
import VipDailyItineraryTimeline from './VipDailyItineraryTimeline'
import VipPreTripServicesCard from './VipPreTripServicesCard'
import VipItineraryActivitiesTab from './VipItineraryActivitiesTab'
import VipItineraryBottomNav, { type ItineraryMainTab } from './VipItineraryBottomNav'
import VipItineraryHotelsTab from './VipItineraryHotelsTab'
import VipConfidentialWatermark from './VipConfidentialWatermark'
import VipItineraryPinGate from './VipItineraryPinGate'
import ClientPortalSignOutButton from './ClientPortalSignOutButton'
import { useVipSessionIdleLock } from '@/lib/use-vip-session-idle-lock'
import VipPackingListCard from './VipPackingListCard'
import PostTripDashboard from './PostTripDashboard'

import {
  clearItineraryUnlock,
  clearWanderloomAccessKey,
  hasItineraryUnlock,
  loadCachedItinerary,
  loadWanderloomAccessKey,
  passcodeMatchesAccessKey,
  persistItineraryCache,
  persistItineraryUnlock,
  persistWanderloomAccessKey,
  registerItineraryServiceWorker,
  warmItineraryOfflineAssets,
} from '@/lib/itinerary-offline-cache'

import {
  fetchPublicItinerary,
  formatTripDateRange,
  googleMapsSearchUrl,
  hasPublicDestinationDiscover,
  type PublicDestinationDiscover,
  type PublicItinerary,
  type PublicWeatherForecast,
} from '@/lib/public-itinerary'
import { isTripFinished } from '@/lib/client-portal-trip-phase'

const WA_CONCIERGE = '966544948640'
const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop'

const EM_DASH = '\u2014'
const ARROW = '\u2190'
const ELLIPSIS = '\u2026'

const GLASS_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#1E2720]/55 p-5 shadow-[0_0_15px_rgba(212,175,55,0.4)] backdrop-blur-md'

const DISCOVER_CARD_CLASS = `${GLASS_CARD_CLASS} transition duration-200 hover:border-[#d4af37]/50 hover:shadow-[0_0_22px_rgba(212,175,55,0.45)]`

/** نمط باركود 1D عمودي ذهبي — عروض متغيرة لمحاكاة مسح واقعي */
const GOLDEN_BARCODE_WIDTHS = [
  2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 1,
  4, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1,
] as const

function StubVerticalLabel({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <span
      className={`block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.14em] text-[#d4af37] ${
        mono ? 'font-mono tracking-wider' : ''
      }`}
      style={{
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
      }}
    >
      {children}
    </span>
  )
}

function waUrl(text: string) {
  return `https://wa.me/${WA_CONCIERGE}?text=${encodeURIComponent(text)}`
}

function flightLine(fd: Record<string, unknown> | null, key: string): string {
  if (!fd) return ''
  const v = fd[key]
  return v != null && String(v).trim() ? String(v).trim() : ''
}

/** عنوان المسار الرئيسي — أسماء مدن بأحرف كبيرة (مثل RIYADH ✈ SHANGHI) */
function routeMainLabel(city: string, fallback: string): string {
  const t = city.trim() || fallback
  return t.toUpperCase()
}

function hasFlightBoardingData(fd: Record<string, unknown> | null): boolean {
  if (!fd) return false
  return Boolean(
    flightLine(fd, 'departureCity') ||
      flightLine(fd, 'arrivalCity') ||
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

function GoldenBoardingBarcode() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-row items-stretch justify-center gap-[1.5px] self-stretch px-0.5 py-2"
      aria-hidden
    >
      {GOLDEN_BARCODE_WIDTHS.map((w, i) => (
        <div
          key={i}
          className={`h-full shrink-0 ${i % 2 === 0 ? 'bg-[#d4af37]' : 'bg-[#d4af37]/12'}`}
          style={{ width: w, minWidth: 1 }}
        />
      ))}
    </div>
  )
}

function WeatherForecastCard({ weather }: { weather: PublicWeatherForecast }) {
  const tempRange = `${weather.tempMin}°C - ${weather.tempMax}°C`
  return (
    <article className={`relative ${GLASS_CARD_CLASS}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/6 via-transparent to-transparent" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2 text-xs font-black text-[#d4af37]">
          <CloudSun className="h-4 w-4 shrink-0" aria-hidden />
          الطقس المتوقع
        </div>
        <h3 className="text-base font-black text-white" dir="ltr">
          {weather.destination}
        </h3>
        <p className="mt-2 text-xl font-black text-[#d4af37]" dir="ltr">
          {tempRange}
        </p>
        <p className="mt-1 text-sm font-semibold text-white/70">{weather.condition}</p>
      </div>
    </article>
  )
}

function CopyTaxiPhraseButton({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 text-[#d4af37] transition hover:bg-[#d4af37]/20"
      aria-label={copied ? 'تم النسخ' : 'نسخ العبارة'}
      title={copied ? 'تم النسخ' : 'نسخ العبارة'}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  )
}

function DiscoverDestinationSection({ discover }: { discover: PublicDestinationDiscover }) {
  if (!hasPublicDestinationDiscover(discover)) return null

  return (
    <section className="mb-8" dir="rtl">
      <h2 className="mb-4 text-center text-lg font-black tracking-wide text-[#d4af37]">اكتشف الوجهة</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {discover.destinationStory ? (
          <article className={`relative ${DISCOVER_CARD_CLASS}`}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/6 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 shrink-0 text-[#d4af37]" strokeWidth={2.25} aria-hidden />
                <h3 className="text-xs font-black text-[#d4af37]">نبذة الوجهة</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-white/85">
                {discover.destinationStory}
              </p>
            </div>
          </article>
        ) : null}

        {discover.taxiPhrase ? (
          <article className={`relative ${DISCOVER_CARD_CLASS}`}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/6 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 shrink-0 text-[#d4af37]" strokeWidth={2.25} aria-hidden />
                <h3 className="text-xs font-black text-[#d4af37]">للتواصل مع السائق</h3>
              </div>
              <div className="flex items-start justify-between gap-3">
                <p
                  className="flex-1 text-lg font-black leading-snug text-white"
                  dir="auto"
                >
                  {discover.taxiPhrase}
                </p>
                <CopyTaxiPhraseButton phrase={discover.taxiPhrase} />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-white/45">اضغط أيقونة النسخ وأرِ العبارة للسائق</p>
            </div>
          </article>
        ) : null}

        {discover.secretGem ? (
          <article
            className={`relative ${DISCOVER_CARD_CLASS} border-[#d4af37]/60 shadow-[0_0_22px_rgba(212,175,55,0.55)] ring-1 ring-[#d4af37]/30`}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/12 via-transparent to-[#161D18]/40" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <Key className="h-5 w-5 shrink-0 text-[#d4af37]" strokeWidth={2.25} aria-hidden />
                <h3 className="text-xs font-black text-[#d4af37]">أسرار الوجهة</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-white/90">
                {discover.secretGem}
              </p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  )
}


function BoardingPassCard({ fd }: { fd: Record<string, unknown> }) {
  const flight = fd
  const from =
    String(flight?.departureCity ?? flight?.from_city ?? flight?.flight_from ?? '').trim() ||
    'وجهة غير محددة'
  const to =
    String(flight?.arrivalCity ?? flight?.to_city ?? flight?.flight_to ?? '').trim() ||
    'وجهة غير محددة'
  const fromMain = from !== 'وجهة غير محددة' ? routeMainLabel(from, from) : from
  const toMain = to !== 'وجهة غير محددة' ? routeMainLabel(to, to) : to
  const flightNo = flightLine(fd, 'flight_number') || EM_DASH
  const gate =
    flightLine(fd, 'gate') ||
    flightLine(fd, 'terminal') ||
    flightLine(fd, 'airport') ||
    EM_DASH
  const seat = flightLine(fd, 'seat') || EM_DASH
  const boarding =
    flightLine(fd, 'boarding_time') ||
    flightLine(fd, 'departure_time') ||
    flightLine(fd, 'leave_home_time') ||
    EM_DASH
  const routeSub =
    from && to && from !== 'وجهة غير محددة' && to !== 'وجهة غير محددة'
      ? `${from} ${ARROW} ${to}`
      : from !== 'وجهة غير محددة'
        ? from
        : to !== 'وجهة غير محددة'
          ? to
          : ''

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#1E2720]/55 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4af37]/8 via-transparent to-[#2A362C]/40" />
      <div className="relative flex min-h-[12rem] flex-row overflow-hidden">
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
            <span className="text-[#d4af37]">{fromMain}</span>
            <span className="mx-2 inline-block text-white/40" aria-hidden>
              {'\u2708\uFE0F'}
            </span>
            <span className="text-[#d4af37]">{toMain}</span>
          </p>
          {routeSub ? (
            <p className="mt-1 text-center text-[11px] font-medium text-white/45" dir="ltr">
              {routeSub}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <div className="flex flex-col items-center justify-center gap-0.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                Flight No
              </p>
              <p className="font-mono text-sm font-bold text-[#d4af37]" dir="ltr">
                {flightNo}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Gate</p>
              <p className="text-sm font-bold text-white">{gate}</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Seat</p>
              <p className="text-sm font-bold text-white">{seat}</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                Boarding
              </p>
              <p className="text-sm font-bold text-white" dir="ltr">
                {boarding}
              </p>
            </div>
          </div>
        </div>

        <aside className="flex w-[6.75rem] shrink-0 flex-row self-stretch overflow-visible border-s border-dashed border-white/20 bg-[#161D18]/60 sm:w-24">
          <div className="flex w-11 shrink-0 flex-col items-center justify-center gap-8 py-5 sm:w-12">
            <div className="flex min-h-[5.5rem] items-center justify-center px-0.5">
              <StubVerticalLabel>WANDERLOOM</StubVerticalLabel>
            </div>
            <div className="flex min-h-[3rem] items-center justify-center px-0.5">
              <StubVerticalLabel mono>
                <span dir="ltr">{flightNo}</span>
              </StubVerticalLabel>
            </div>
          </div>
          <GoldenBoardingBarcode />
        </aside>
      </div>
    </section>
  )
}

type PublicVipItineraryViewProps = {
  slug?: string
  /** بيانات الرحلة من `page.tsx` (Supabase) */
  initialTrip?: PublicItinerary | null
  initialPinCode?: string | null
  /** يُمرَّر من Server Component — يقرأ .env.local بشكل موثوق */
  mapboxAccessToken?: string
}

export default function PublicVipItineraryView({
  slug: slugProp,
  initialTrip = null,
  initialPinCode = null,
  mapboxAccessToken,
}: PublicVipItineraryViewProps = {}) {
  const params = useParams<{ id: string }>()
  const slug = String(slugProp ?? params?.id ?? '').trim()

  const [trip, setTrip] = useState<PublicItinerary | null>(initialTrip)
  const [pinRequired, setPinRequired] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialTrip)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [authenticated, setAuthenticated] = useState(() => {
    if (!initialTrip) return false
    if (!initialTrip.hasPin || !initialPinCode) return true
    return hasItineraryUnlock(slug)
  })
  const [activeTab, setActiveTab] = useState<ItineraryMainTab>('overview')
  const [offlineMode, setOfflineMode] = useState(false)
  const [pinExiting, setPinExiting] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [itineraryRevealed, setItineraryRevealed] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  const { sessionLocked, resetSessionLock } = useVipSessionIdleLock(
    authenticated && !!trip?.hasPin,
  )

  useEffect(() => {
    if (!sessionLocked) return
    setSessionExpired(true)
    setAuthenticated(false)
    clearItineraryUnlock(slug)
    setPinInput('')
    setPinError('')
  }, [sessionLocked, slug])

  useEffect(() => {
    if (!initialTrip) return
    const pinCode = initialPinCode
    if (!initialTrip.hasPin || !pinCode) {
      setPinRequired(null)
      setAuthenticated(true)
    } else if (hasItineraryUnlock(slug)) {
      setPinRequired(pinCode)
      setAuthenticated(true)
    } else {
      setPinRequired(pinCode)
      setAuthenticated(false)
    }
  }, [initialTrip, initialPinCode, slug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!initialTrip) setLoading(true)
      let result = await fetchPublicItinerary(slug)
      let fromCache = false

      if (!result.trip) {
        const cached = loadCachedItinerary(slug)
        if (cached) {
          result = { trip: cached, pinCode: null }
          fromCache = true
        }
      }

      if (cancelled) return

      if (!result.trip) {
        setTrip(null)
        setOfflineMode(false)
        setLoading(false)
        return
      }

      setTrip(result.trip)
      setOfflineMode(fromCache)

      const pinCode = result.pinCode
      const savedKey = loadWanderloomAccessKey()
      const unlocked =
        hasItineraryUnlock(slug) ||
        (!!pinCode && passcodeMatchesAccessKey(pinCode, savedKey ?? undefined))

      if (!result.trip.hasPin || !pinCode) {
        setAuthenticated(true)
        setPinRequired(null)
      } else if (unlocked) {
        setPinRequired(pinCode)
        setAuthenticated(true)
        if (savedKey && passcodeMatchesAccessKey(pinCode, savedKey)) {
          setPinInput(savedKey)
        }
        persistItineraryUnlock(slug)
      } else {
        setPinRequired(pinCode)
        setAuthenticated(false)
        if (savedKey) setPinInput(savedKey)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [slug, initialTrip])

  useEffect(() => {
    if (!authenticated || !trip) return
    persistItineraryCache(slug, trip)
    persistItineraryUnlock(slug)
    void registerItineraryServiceWorker()
    void warmItineraryOfflineAssets(slug)
  }, [authenticated, trip, slug])

  const salonPreTripServices = trip
    ? filterNonMedicalPreTripServices(trip.preTripServices ?? [])
    : []

  const handlePin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinRequired) return
    const entered = pinInput.trim().toUpperCase()
    if (entered === pinRequired.trim().toUpperCase()) {
      setPinError('')
      setSessionExpired(false)
      resetSessionLock()
      setUnlocking(true)
      setPinExiting(true)
      persistWanderloomAccessKey(entered)
      persistItineraryUnlock(slug)
      if (trip) persistItineraryCache(slug, trip)
      window.setTimeout(() => {
        setAuthenticated(true)
        setUnlocking(false)
        setPinExiting(false)
      }, 320)
    } else {
      clearWanderloomAccessKey()
      clearItineraryUnlock(slug)
      setPinError('\u0627\u0644\u0631\u0645\u0632 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.')
    }
  }

  useEffect(() => {
    if (!authenticated) {
      setItineraryRevealed(false)
      return
    }
    const id = window.requestAnimationFrame(() => setItineraryRevealed(true))
    return () => window.cancelAnimationFrame(id)
  }, [authenticated])

  if (loading) {
    return (
      <div
        dir="rtl"
        className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#1E2720] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#d4af37]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#d4af37]/10 via-[#1E2720] to-[#1E2720]"
        />
        <p className="relative z-[1] animate-pulse text-sm font-semibold tracking-wide">
          {'\u062c\u0627\u0631\u064a \u062a\u062c\u0647\u064a\u0632 \u0631\u062d\u0644\u062a\u0643' + ELLIPSIS}
        </p>
      </div>
    )
  }

  if (!trip) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[100dvh] items-center justify-center bg-[#1E2720] px-6 text-center font-sans text-rose-200"
      >
        <p className="text-sm font-semibold">
          {'\u0627\u0644\u0631\u0627\u0628\u0637 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0627\u0646\u062a\u0647\u062a \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0631\u062d\u0644\u0629.'}
        </p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <VipItineraryPinGate
        pinInput={pinInput}
        onPinChange={setPinInput}
        pinError={pinError}
          onSubmit={handlePin}
        exiting={pinExiting}
        unlocking={unlocking}
        sessionExpired={sessionExpired}
      />
    )
  }

  const dateRange = formatTripDateRange(trip.startDate, trip.endDate)
  const tripFinished = isTripFinished(trip.endDate)
  const fd = trip.flightDetails
  const conciergeText = `\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u0646\u0627 ${trip.customerName}\u060c \u0623\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0628\u062e\u0635\u0648\u0635 \u0631\u062d\u0644\u062a\u064a \u0625\u0644\u0649 ${trip.destination}.`

  return (
    <div
      dir="rtl"
      className={`min-h-[100dvh] select-none bg-[#1E2720] pb-28 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-white transition-opacity duration-300 ease-out ${
        itineraryRevealed ? 'opacity-100' : 'opacity-0'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <VipConfidentialWatermark />
      {offlineMode ? (
        <p
          className="bg-[#d4af37]/15 px-4 py-2 text-center text-xs font-bold text-[#d4af37]"
          role="status"
        >
          {'\u0648\u0636\u0639 \u0627\u0644\u0639\u0631\u0636 \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644 \u2014 \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u062e\u0632\u0651\u0646\u0629 \u0645\u062d\u0644\u064a\u0627\u064b'}
        </p>
      ) : null}
      <header className="relative min-h-[42vh] overflow-hidden">
        {trip.hasPin ? (
          <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-5">
            <ClientPortalSignOutButton slug={slug} variant="dark" />
          </div>
        ) : null}
        <img
          src={trip.coverImage || DEFAULT_HERO}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E2720] via-[#1E2720]/75 to-[#1E2720]/40" />
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
            مرحباً، {trip.customerName}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:max-w-4xl sm:px-6">
        {trip.isMedical ? <VipMedicalConciergeBanner services={trip.preTripServices ?? []} /> : null}

        {tripFinished ? (
          <div className="py-4">
            <PostTripDashboard
              trip={trip}
              dateRange={dateRange}
              variant="dark"
              currentItinerarySlug={slug}
            />
          </div>
        ) : (
          <>
        {activeTab === 'overview' ? (
        <>
        <div className="relative z-10 -mt-6 mb-4 space-y-4">
          {hasFlightBoardingData(fd) ? <BoardingPassCard fd={fd!} /> : null}

          <div className="space-y-4">
            {trip.weather ? <WeatherForecastCard weather={trip.weather} /> : null}
            <VipPackingListCard />
            </div>
                </div>

        <DiscoverDestinationSection discover={trip.discover} />

        {trip.highlights.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-[#d4af37]">
              {'\u0623\u0628\u0631\u0632 \u0627\u0644\u0644\u062d\u0638\u0627\u062a'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {trip.highlights.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-[#d4af37]/30 bg-[#2A362C] px-3 py-1.5 text-xs font-bold text-white/90"
                >
                  {h}
                </span>
              ))}
            </div>
          </section>
        ) : null}
        <a
          href={googleMapsSearchUrl(trip.destination)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-[#d4af37]/35 bg-[#2A362C] py-4 text-sm font-black text-[#d4af37] transition hover:bg-[#354239]"
        >
          <MapPin className="h-5 w-5 shrink-0" aria-hidden />
          {'\u0627\u0633\u062a\u0643\u0634\u0641'} {trip.destination} {'\u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629'}
        </a>
        </>
        ) : null}

        {activeTab === 'itinerary' ? (
          <section className="mb-10 pt-2 font-[family-name:var(--font-tajawal),system-ui,sans-serif]">
            {salonPreTripServices.length > 0 ? (
              <div className="mb-6">
                <VipPreTripServicesCard services={salonPreTripServices} />
              </div>
            ) : null}
            <VipDailyItineraryTimeline
              days={trip.days}
              destination={trip.destination}
              tripTitle={trip.title}
              coverImage={trip.coverImage}
              startDate={trip.startDate}
              endDate={trip.endDate}
              mapboxAccessToken={mapboxAccessToken}
              tripId={trip.id}
              magicLinkId={trip.magicLinkId}
              clientId={trip.clientId}
            />
          </section>
        ) : null}

        {activeTab === 'bookings' ? (
          <section className="mb-10 space-y-8 pt-2">
            <div>
              <h2 className="mb-4 text-center text-base font-black text-[#1E2720]">الفنادق</h2>
              <VipItineraryHotelsTab hotels={trip.hotels} />
            </div>
            <div>
              <h2 className="mb-4 text-center text-base font-black text-[#1E2720]">الفعاليات والتجارب</h2>
              <VipItineraryActivitiesTab experiences={trip.experiences} />
            </div>
          </section>
        ) : null}
          </>
        )}
      </main>

      {!tripFinished ? (
      <VipItineraryBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      ) : null}

      <a
        href={waUrl(conciergeText)}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 left-6 z-50 flex items-center gap-2.5 rounded-full border border-[#d4af37]/50 bg-[#d4af37] px-5 py-3.5 text-sm font-black text-[#1E2720] shadow-[0_0_15px_rgba(212,175,55,0.4)] transition hover:scale-[1.03] hover:shadow-[0_0_22px_rgba(212,175,55,0.55)] active:scale-[0.98] sm:bottom-28 sm:left-8"
        aria-label="الكونسيرج الشخصي — واتساب"
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.25} />
        <span>الكونسيرج الشخصي</span>
      </a>
    </div>
  )
}


