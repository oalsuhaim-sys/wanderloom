'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { DayWeatherPayload } from '@/lib/weather'
import {
  extractWeatherCity,
  isoDateForItineraryDay,
  weatherEmoji,
} from '@/lib/weather'

type DayWeatherPillProps = {
  city?: string | null
  /** وجهة الرحلة كاحتياطي لاستخراج المدينة */
  destination?: string | null
  /** YYYY-MM-DD مباشر */
  date?: string | null
  /** أو احسب التاريخ من بداية الرحلة + فهرس اليوم */
  startDate?: string | null
  dayIndex?: number
  className?: string
  /** `dark` = gold-on-dark styling for the route view (default unchanged). */
  variant?: 'light' | 'dark'
}

export default function DayWeatherPill({
  city,
  destination,
  date,
  startDate,
  dayIndex = 0,
  className = '',
  variant = 'light',
}: DayWeatherPillProps) {
  const tone =
    variant === 'dark'
      ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#F3EBDD]'
      : 'bg-blue-50 text-blue-700'
  const queryCity = useMemo(() => {
    const direct = String(city ?? '').trim()
    if (direct) return extractWeatherCity(direct)
    return extractWeatherCity(String(destination ?? '').trim())
  }, [city, destination])

  const queryDate = useMemo(() => {
    const direct = String(date ?? '').trim()
    if (direct) return direct
    return isoDateForItineraryDay(startDate, dayIndex)
  }, [date, startDate, dayIndex])

  const [data, setData] = useState<DayWeatherPayload | null>(null)
  const [loading, setLoading] = useState(Boolean(queryCity))

  useEffect(() => {
    if (!queryCity) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ city: queryCity })
    if (queryDate) params.set('date', queryDate)

    void (async () => {
      try {
        const res = await fetch(`/api/weather?${params.toString()}`)
        if (!res.ok) throw new Error('weather fetch failed')
        const json = (await res.json()) as DayWeatherPayload
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [queryCity, queryDate])

  if (!queryCity) return null

  if (loading && !data) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tone} ${className}`}
        aria-label="جاري تحميل الطقس"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        الطقس…
      </span>
    )
  }

  if (!data) return null

  const emoji = data.emoji || weatherEmoji(data.icon)

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-sm ${tone} ${className}`}
      title={`${data.condition} · ${data.city}${data.date ? ` · ${data.date}` : ''}`}
      aria-label={`طقس ${data.city}: ${data.tempMin} إلى ${data.tempMax} درجة`}
      dir="ltr"
    >
      <span aria-hidden className="text-sm leading-none">
        {emoji}
      </span>
      <span className="font-bold tabular-nums">
        {data.tempMax}° / {data.tempMin}°
      </span>
      <span className={`font-semibold ${variant === 'dark' ? 'text-[#D4AF37]' : 'hidden text-blue-600/80 sm:inline'}`} dir="rtl">
        {data.condition}
      </span>
    </div>
  )
}
