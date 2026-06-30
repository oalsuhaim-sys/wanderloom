'use client'

import { MapPin, Star } from 'lucide-react'

import { type PublicItineraryExperience } from '@/lib/public-itinerary'

const GLASS_CARD_CLASS =
  'overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-white shadow-sm'

const TXT_DIRECTIONS = '\uD83D\uDCCD \u0627\u0644\u0627\u062a\u062c\u0627\u0647\u0627\u062a'
const TXT_TICKETS = '\uD83C\uDF9F\uFE0F \u062d\u062c\u0632 \u0627\u0644\u062a\u0630\u0627\u0643\u0631'
const TXT_EMPTY =
  '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0645\u0633\u062c\u0651\u0644\u0629 \u0628\u0639\u062f \u2014 \u0633\u064a\u062a\u0648\u0627\u0635\u0644 \u0641\u0631\u064a\u0642 \u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0628\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644.'

type VipItineraryActivitiesTabProps = {
  experiences: PublicItineraryExperience[]
}

export default function VipItineraryActivitiesTab({ experiences }: VipItineraryActivitiesTabProps) {
  if (experiences.length === 0) {
    return (
      <p className="rounded-xl border border-[#D4AF37]/25 bg-white py-12 text-center text-sm font-medium text-[#1E2720]/55 shadow-sm">
        {TXT_EMPTY}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {experiences.map((exp) => {
        const bookingHref = exp.bookingUrl?.trim() || null
        return (
          <article key={exp.id} className={GLASS_CARD_CLASS}>
            <div className="flex flex-row gap-3 p-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-[#F9F9F6]">
                {exp.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={exp.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Star className="h-8 w-8 text-[#d4af37]/30" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#1E2720] sm:text-base">{exp.title}</h3>
                  {exp.dateTime ? (
                    <span
                      className="shrink-0 rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10 px-2 py-0.5 text-[10px] font-bold text-[#d4af37]"
                      dir="ltr"
                    >
                      {exp.dateTime}
                    </span>
                  ) : null}
                </div>
                {exp.description ? (
                  <p className="line-clamp-2 text-xs font-medium leading-relaxed text-[#1E2720]/80 sm:text-sm">
                    {exp.description}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-center gap-2 border-t border-[#1E2720]/10 pt-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exp.mapsQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#D4AF37] bg-transparent py-2 px-4 text-sm font-bold text-[#1E2720] transition-colors hover:bg-[#D4AF37]/10 ${bookingHref ? '' : 'max-w-xs flex-none'}`}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                    <span>{TXT_DIRECTIONS}</span>
                  </a>
                  {bookingHref ? (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#D4AF37] bg-transparent py-2 px-4 text-sm font-bold text-[#1E2720] transition-colors hover:bg-[#D4AF37]/10"
                    >
                      <span>{TXT_TICKETS}</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
