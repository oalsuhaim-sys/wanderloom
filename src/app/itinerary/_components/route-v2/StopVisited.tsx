'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { RV } from './route-utils'

/** «زرت المكان؟» → tap → «زرته ✓». Tapping again clears it. Staff see it in the CRM editor. */
export default function StopVisitedButton({ value, onChange }: { value: boolean; onChange: (v: boolean) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    if (busy) return
    setBusy(true)
    await onChange(!value)
    setBusy(false)
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-black transition active:scale-95"
      style={
        value
          ? { borderColor: RV.gold, background: RV.gold, color: RV.onGold }
          : { borderColor: RV.lineStrong, background: 'transparent', color: RV.muted }
      }
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border"
        style={{ borderColor: value ? RV.onGold : RV.lineStrong }}
        aria-hidden
      >
        {value ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {value ? 'زرته' : 'زرت المكان؟'}
    </button>
  )
}
