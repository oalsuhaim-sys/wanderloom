'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { RV } from './route-utils'

/** «قيّم المحطة ☆☆☆☆☆» under a stop — one tap saves; tapping again changes it. */
export default function StopStarRating({ value, onRate }: { value: number | undefined; onRate: (v: number) => Promise<boolean> }) {
  const [hover, setHover] = useState(0)
  const [thanks, setThanks] = useState(false)
  const shown = hover || value || 0

  const pick = async (v: number) => {
    const ok = await onRate(v)
    setThanks(ok)
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 ps-[60px] text-[11.5px] font-bold" dir="rtl" style={{ color: RV.muted }}>
      <span>{value ? (thanks ? 'شكراً لتقييمك' : 'تقييمك') : 'قيّم المحطة'}</span>
      <span className="inline-flex items-center" role="radiogroup" aria-label="تقييم المحطة" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`${v} من 5`}
            onMouseEnter={() => setHover(v)}
            onClick={() => void pick(v)}
            className="p-0.5 transition-transform active:scale-90"
          >
            <Star
              className="h-[18px] w-[18px]"
              style={{ color: v <= shown ? RV.gold : RV.lineStrong, fill: v <= shown ? RV.gold : 'transparent' }}
              strokeWidth={1.8}
              aria-hidden
            />
          </button>
        ))}
      </span>
    </div>
  )
}
