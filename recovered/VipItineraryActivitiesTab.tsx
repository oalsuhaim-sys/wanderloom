'use client'

import { MapPin, Star, Ticket } from 'lucide-react'

import { type PublicItineraryExperience } from '@/lib/public-itinerary'

const GLASS_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[#d4af37]/35 bg-[#001f3f]/55 shadow-[0_0_15px_rgba(212,175,55,0.35)] backdrop-blur-md'

const TXT_TICKET = '\u0627\u0644\u062a\u0630\u0643\u0631\u0629'
const TXT_EMPTY =
  '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0645\u0633\u062c\u0651\u0644\u0629 \u0628\u0639\u062f \u2014 \u0633\u064a\u062a\u0648\u0627\u0635\u0644 \u0641\u0631\u064a\u0642 \u0627\u0644\u0643\u0648\u0646\u0633\u064a\u0631\u062c \u0628\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644.'

type VipItineraryActivitiesTabProps = {
  experiences: PublicItineraryExperience[]
}

export default function VipItineraryActivitiesTab({ experiences }: VipItineraryActivitiesTabProps) {
  if (experiences.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#002a55]/60 py-12 text-center text-sm font-medium text-white/60">
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
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#d4af37]/35 bg-gradient-to-br from-[#002a55] to-[#00152e]">
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
                  <h3 className="text-sm font-extrabold text-[#d4af37] sm:text-base">{exp.title}</h3>
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
                  <p className="line-clamp-2 text-xs font-medium leading-relaxed text-white/65 sm:text-sm">
                    {exp.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {bookingHref ? (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/45 px-3 py-2 text-[11px] font-bold text-[#d4af37] transition hover:bg-[#d4af37]/10"
                    >
                      <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{TXT_TICKET}</span>
                    </a>
                  ) : (
                    <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/25 px-3 py-2 text-[11px] font-bold text-white/35">
                      <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{TXT_TICKET}</span>
                    </span>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exp.mapsQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/45 px-3 py-2 text-[11px] font-bold text-[#d4af37] transition hover:bg-[#d4af37]/10"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{'\u0627\u0644\u0645\u0648\u0642\u0639'}</span>
                  </a>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
