'use client'

import { BedDouble, MapPin } from 'lucide-react'

import { googleMapsSearchUrl, type PublicItineraryHotel } from '@/lib/public-itinerary'

const GLASS_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#001f3f]/55 shadow-[0_0_15px_rgba(212,175,55,0.35)] backdrop-blur-md'

const TXT_LOCATION = '\u0627\u0644\u0645\u0648\u0642\u0639'
const TXT_CHECKIN = '\u0648\u0635\u0648\u0644 \u0627\u0644\u0648\u0635\u0648\u0644'
const TXT_CHECKOUT = '\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629'
const TXT_REF = '\u0631\u0642\u0645 \u0627\u0644\u062d\u062c\u0632'
const TXT_EMPTY =
  '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0646\u0627\u062f\u0642 \u0645\u0633\u062c\u0651\u0644\u0629 \u0628\u0639\u062f \u2014 \u0633\u064a\u062a\u0648\u0627\u0635\u0644 \u0641\u0631\u064a\u0642 \u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0628\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644.'

type VipItineraryHotelsTabProps = {
  hotels: PublicItineraryHotel[]
}

export default function VipItineraryHotelsTab({ hotels }: VipItineraryHotelsTabProps) {
  if (hotels.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#002a55]/60 py-12 text-center text-sm font-medium text-white/60">
        {TXT_EMPTY}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {hotels.map((hotel) => (
        <article key={hotel.id} className={GLASS_CARD_CLASS}>
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#00152e]">
            {hotel.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hotel.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#001f3f]/80 via-transparent to-transparent" />
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <BedDouble className="h-12 w-12 text-[#d4af37]/25" aria-hidden />
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-base font-extrabold text-[#d4af37]">{hotel.name}</h3>
            {hotel.city ? <p className="mt-1 text-xs font-medium text-white/55">{hotel.city}</p> : null}
            <dl className="mt-3 space-y-1.5 text-xs">
              {hotel.checkIn ? (
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-white/45">{TXT_CHECKIN}</dt>
                  <dd className="font-bold text-white/85" dir="ltr">
                    {hotel.checkIn}
                  </dd>
                </div>
              ) : null}
              {hotel.checkOut ? (
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-white/45">{TXT_CHECKOUT}</dt>
                  <dd className="font-bold text-white/85" dir="ltr">
                    {hotel.checkOut}
                  </dd>
                </div>
              ) : null}
              {hotel.bookingReference ? (
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-white/45">{TXT_REF}</dt>
                  <dd className="font-mono text-[11px] font-bold text-[#d4af37]" dir="ltr">
                    {hotel.bookingReference}
                  </dd>
                </div>
              ) : null}
            </dl>
            <a
              href={googleMapsSearchUrl(hotel.mapsQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d4af37]/45 bg-transparent px-3 py-2.5 text-xs font-bold text-[#d4af37] transition hover:bg-[#d4af37]/10"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{TXT_LOCATION}</span>
            </a>
          </div>
        </article>
      ))}
    </div>
  )
}
