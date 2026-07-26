'use client'

import { useMemo } from 'react'
import { CalendarDays, Plane } from 'lucide-react'

import { formatShortArabicDate } from '@/lib/public-itinerary'
import { barcodeWidthsFromSeed } from '@/lib/vip-boarding-barcode'
import {
  buildVipFlightVoucherFields,
  hasVipFlightVoucherData,
  vipBoardingBarcodeCaption,
  vipFlightArrivalCity,
  vipFlightArrivalCountry,
  vipFlightDepartureCity,
  vipFlightDepartureCountry,
  type VipFlightDetails,
} from '@/lib/vip-flight-voucher'
import type { PublicItinerary } from '@/lib/public-itinerary'

const GOLD = '#C5A059'

export type PremiumBoardingPassData = {
  passengerName: string
  tripTitle: string
  dateLabel: string
  departureCountry: string
  arrivalCountry: string
  departureCity: string
  arrivalCity: string
  departureTime: string
  arrivalTime: string
  flightNumber: string
  seat: string
  gate: string
  terminal: string
  flightClass: string
  bookingRef: string
}

/** Premium dummy data — Budapest showcase for layout review */
export const PREMIUM_BOARDING_PASS_DEMO: PremiumBoardingPassData = {
  passengerName: 'Hala Hakami',
  tripTitle: 'Budapest Private Escape',
  dateLabel: '١٩ يول ٢٠٢٦',
  departureCountry: 'السعودية',
  arrivalCountry: 'هنغاريا',
  departureCity: 'الرياض',
  arrivalCity: 'بودابست',
  departureTime: '09:40',
  arrivalTime: '14:15',
  flightNumber: 'SV 193',
  seat: '2A',
  gate: 'C12',
  terminal: 'T1',
  flightClass: 'Business',
  bookingRef: 'WL-HALA7X',
}

function displayValue(value: string | null | undefined): string {
  const s = value?.trim()
  if (!s || s === '—') return '-'
  return s
}

function containsArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value)
}

function textDir(value: string): 'rtl' | 'ltr' {
  return containsArabic(value) ? 'rtl' : 'ltr'
}

function dataFromTrip(trip: PublicItinerary): PremiumBoardingPassData | null {
  const fd = trip.flightDetails as VipFlightDetails
  if (!fd || !hasVipFlightVoucherData(fd)) return null

  const f = buildVipFlightVoucherFields(fd)
  const fromCity = vipFlightDepartureCity(fd) || 'المغادرة'
  const toCity = vipFlightArrivalCity(fd) || 'الوصول'
  const fromCountry = vipFlightDepartureCountry(fd) || 'المغادرة'
  const toCountry = vipFlightArrivalCountry(fd) || 'الوصول'
  const bookingRef = vipBoardingBarcodeCaption(
    fd,
    trip.magicLinkId?.slice(0, 12) ?? `WL-${String(trip.id).slice(0, 8)}`,
  )

  // Boarding pass: single departure date only (never the trip range)
  const dateLabel = trip.startDate ? formatShortArabicDate(trip.startDate) : '-'

  return {
    passengerName: trip.customerName?.trim() || 'Honoured Guest',
    tripTitle: trip.title?.trim() || 'Your Journey',
    dateLabel,
    departureCountry: fromCountry,
    arrivalCountry: toCountry,
    departureCity: fromCity,
    arrivalCity: toCity,
    departureTime: f.departure,
    arrivalTime: f.arrival,
    flightNumber: f.flightNumber,
    seat: f.seat,
    gate: f.gate,
    terminal: f.terminal,
    flightClass: f.flightClass,
    bookingRef,
  }
}

function PremiumBarcode({ seed }: { seed: string }) {
  const widths = useMemo(() => barcodeWidthsFromSeed(seed, 48), [seed])

  return (
    <div
      className="mx-auto flex h-12 max-w-[260px] items-stretch justify-center gap-px overflow-hidden bg-white px-1"
      role="img"
      aria-label={`Booking barcode ${seed}`}
    >
      {widths.map((w, i) => (
        <div
          key={`${seed}-${i}`}
          className="h-full shrink-0 bg-[#2C2C2C]"
          style={{ width: w }}
        />
      ))}
    </div>
  )
}

type Props = {
  /** When provided with flight details, real trip data is used; otherwise demo data. */
  trip?: PublicItinerary | null
  dateRange?: string | null
  /** Force demo layout regardless of trip */
  useDemoData?: boolean
  className?: string
}

/**
 * Premium boarding / booking card — luxury Off-White theme.
 * Giant labels = countries; cities sit under the timeline.
 */
export default function PremiumBoardingPass({
  trip = null,
  useDemoData = false,
  className = '',
}: Props) {
  const data =
    !useDemoData && trip
      ? dataFromTrip(trip) ?? PREMIUM_BOARDING_PASS_DEMO
      : PREMIUM_BOARDING_PASS_DEMO

  const passengerDir = textDir(data.passengerName)
  const depCountryDir = textDir(data.departureCountry)
  const arrCountryDir = textDir(data.arrivalCountry)
  const depCityDir = textDir(data.departureCity)
  const arrCityDir = textDir(data.arrivalCity)

  return (
    <section
      className={`w-full bg-[#F9F9F6] px-4 py-6 sm:px-6 ${className}`}
      dir="ltr"
    >
      <article
        className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-[#E5D3B3]/30 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:max-w-xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F9F9F6] ring-1 ring-[#E5D3B3]/40"
              aria-hidden
            >
              <Plane className="h-5 w-5" style={{ color: GOLD }} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">
                Flight Boarding Pass
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#2C2C2C]">
                Booking Details
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
            style={{ color: GOLD, backgroundColor: 'rgba(197,160,89,0.1)' }}
          >
            VIP
          </span>
        </header>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {/* Passenger */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Passenger
              </p>
              <p
                className="mt-1 truncate text-lg font-bold text-[#2C2C2C] sm:text-xl"
                dir={passengerDir}
              >
                {data.passengerName}
              </p>
              <p
                className="mt-1 truncate text-sm font-medium text-gray-500"
                dir={textDir(data.tripTitle)}
              >
                {data.tripTitle}
              </p>
            </div>
            <p
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F9F9F6] px-3 py-1.5 text-[11px] font-semibold leading-snug text-gray-600 sm:text-xs"
              dir="rtl"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} aria-hidden />
              <span className="whitespace-nowrap">{displayValue(data.dateLabel)}</span>
            </p>
          </div>

          {/* Flight path: giant COUNTRIES, cities under timeline */}
          <div className="rounded-2xl bg-[#F9F9F6] px-4 py-5 sm:px-6" dir="rtl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Departure
                </p>
                <p
                  className="mt-1 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl"
                  dir={depCountryDir}
                >
                  {data.departureCountry}
                </p>
                <p
                  className="mt-1 truncate text-sm font-medium text-gray-500"
                  dir={depCityDir}
                >
                  {data.departureCity}
                </p>
                <p
                  className="mt-2 font-mono text-base font-bold"
                  style={{ color: GOLD }}
                  dir="ltr"
                >
                  {displayValue(data.departureTime)}
                </p>
              </div>

              <div className="flex w-[28%] max-w-[7.5rem] shrink-0 flex-col items-center px-1 pt-6">
                <div className="relative flex w-full items-center">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: GOLD }}
                    aria-hidden
                  />
                  <span
                    className="mx-1 h-px flex-1"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${GOLD}, rgba(197,160,89,0.25))`,
                    }}
                    aria-hidden
                  />
                  <Plane
                    className="h-4 w-4 shrink-0 rotate-90"
                    style={{ color: GOLD }}
                    aria-hidden
                  />
                  <span
                    className="mx-1 h-px flex-1"
                    style={{
                      backgroundImage: `linear-gradient(90deg, rgba(197,160,89,0.25), ${GOLD})`,
                    }}
                    aria-hidden
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: GOLD }}
                    aria-hidden
                  />
                </div>
                <p
                  className="mt-2 font-mono text-[10px] font-bold tracking-wide"
                  style={{ color: GOLD }}
                  dir="ltr"
                >
                  {displayValue(data.flightNumber)}
                </p>
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Arrival
                </p>
                <p
                  className="mt-1 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl"
                  dir={arrCountryDir}
                >
                  {data.arrivalCountry}
                </p>
                <p
                  className="mt-1 truncate text-sm font-medium text-gray-500"
                  dir={arrCityDir}
                >
                  {data.arrivalCity}
                </p>
                <p
                  className="mt-2 font-mono text-base font-bold"
                  style={{ color: GOLD }}
                  dir="ltr"
                >
                  {displayValue(data.arrivalTime)}
                </p>
              </div>
            </div>
          </div>

          {/* Details grid — strict RTL, contained cells */}
          <div
            className="mt-8 grid w-full grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3"
            dir="rtl"
          >
            {(
              [
                { label: 'Date', value: displayValue(data.dateLabel), ltr: false },
                {
                  label: 'Flight No',
                  value: displayValue(data.flightNumber),
                  ltr: true,
                  highlight: true,
                },
                { label: 'Seat', value: displayValue(data.seat), ltr: true },
                { label: 'Gate', value: displayValue(data.gate), ltr: true },
                { label: 'Terminal', value: displayValue(data.terminal), ltr: true },
                { label: 'Class', value: displayValue(data.flightClass), ltr: true },
              ] as const
            ).map((item) => (
              <div key={item.label} className="flex min-w-0 flex-col text-right">
                <span className="mb-1 text-xs uppercase tracking-wider text-gray-400">
                  {item.label}
                </span>
                <span
                  className={`text-sm font-bold text-gray-900 ${
                    'highlight' in item && item.highlight ? 'font-mono text-[#C5A059]' : ''
                  } ${item.label === 'Date' ? 'whitespace-nowrap' : 'truncate'}`}
                  dir={item.ltr ? 'ltr' : textDir(item.value)}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider + barcode footer */}
        <footer className="border-t border-dashed border-gray-200 bg-[#F9F9F6]/80 px-6 py-5 sm:px-8">
          <PremiumBarcode seed={data.bookingRef} />
          <p
            className="mt-3 text-center font-mono text-xs font-bold tracking-[0.35em] text-[#2C2C2C]"
            dir="ltr"
          >
            {data.bookingRef}
          </p>
          <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-gray-500">
            PNR / Booking Reference
          </p>
        </footer>
      </article>
    </section>
  )
}
