'use client'

import { Car, MapPin, X } from 'lucide-react'

import {
  buildUberDeepLink,
  googleMapsSearchUrl,
  type PublicItineraryActivity,
} from '@/lib/public-itinerary'

const TXT_DIRECTIONS = '\u0627\u0644\u0627\u062a\u062c\u0627\u0647\u0627\u062a'
const TXT_UBER = '\u0623\u0648\u0628\u0631'

type VipMapActivitySheetProps = {
  activity: PublicItineraryActivity
  order: number
  onClose: () => void
}

export default function VipMapActivitySheet({ activity, order, onClose }: VipMapActivitySheetProps) {
  const mapsHref = googleMapsSearchUrl(activity.mapsQuery)
  const uberHref = buildUberDeepLink(activity.mapsQuery)
  const imageUrl = activity.imageUrl?.trim()

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-[1000] overflow-hidden rounded-2xl border border-[#d4af37]/45 bg-[#00152e]/95 shadow-[0_0_28px_rgba(0,0,0,0.55)] backdrop-blur-md"
      role="dialog"
      aria-label={activity.title}
    >
      <div className="flex gap-3 p-3 sm:p-4" dir="rtl">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#d4af37]/35 bg-[#001f3f]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-lg font-black text-[#d4af37]/40">
              {order}
            </div>
          )}
          <span className="absolute -start-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#001f3f] bg-[#d4af37] text-[10px] font-black text-[#001f3f]">
            {order}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#d4af37]/70" dir="ltr">
                {activity.timeLabel}
              </p>
              <h4 className="mt-0.5 text-sm font-extrabold leading-snug text-white sm:text-base">
                {activity.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/15 p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="\u0625\u063a\u0644\u0627\u0642"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {activity.description ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium text-white/60">{activity.description}</p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/45 px-3 py-2 text-[11px] font-bold text-[#d4af37] transition hover:bg-[#d4af37]/10"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{'\uD83D\uDCCD'} {TXT_DIRECTIONS}</span>
            </a>
            <a
              href={uberHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d4af37]/45 px-3 py-2 text-[11px] font-bold text-[#d4af37] transition hover:bg-[#d4af37]/10"
            >
              <Car className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{'\uD83D\uDE95'} {TXT_UBER}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
