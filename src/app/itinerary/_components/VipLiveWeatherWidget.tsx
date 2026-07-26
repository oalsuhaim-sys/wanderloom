'use client'

import { useEffect, useMemo, useState } from 'react'
import { Cloud, CloudRain, CloudSun, Loader2, Snowflake, Sun, Zap } from 'lucide-react'

import type { PublicWeatherForecast } from '@/lib/public-itinerary'
import {
  extractWeatherCity,
  weatherEmoji,
  type DayWeatherApiPayload,
} from '@/lib/weather'

export { extractWeatherCity }

type VipLiveWeatherWidgetProps = {
  /** نص الوجهة من المسار — يُستخرج منه اسم المدينة */
  destination: string
  fallback?: PublicWeatherForecast | null
  className?: string
}

function WeatherIcon({ code, large }: { code: string; large?: boolean }) {
  const className = large
    ? 'h-7 w-7 shrink-0 text-[#D4AF37]'
    : 'h-6 w-6 shrink-0 text-[#D4AF37]'
  switch (code) {
    case 'clear':
      return <Sun className={className} aria-hidden />
    case 'rain':
      return <CloudRain className={className} aria-hidden />
    case 'storm':
      return <Zap className={className} aria-hidden />
    case 'snow':
      return <Snowflake className={className} aria-hidden />
    case 'cloud':
      return <Cloud className={className} aria-hidden />
    default:
      return <CloudSun className={className} aria-hidden />
  }
}

function forecastToPayload(city: string, f: PublicWeatherForecast): DayWeatherApiPayload {
  const temp = Math.round((f.tempMin + f.tempMax) / 2)
  const icon = 'partly' as const
  return {
    city: f.destination || city,
    date: null,
    temp,
    tempMin: f.tempMin,
    tempMax: f.tempMax,
    condition: f.condition,
    icon,
    emoji: weatherEmoji(icon),
    source: 'placeholder',
  }
}

function sourceLabel(source: DayWeatherApiPayload['source']): string {
  if (source === 'open-meteo') return 'مباشر'
  if (source === 'openweather') return 'مباشر'
  return 'تقديري'
}

export default function VipLiveWeatherWidget({
  destination,
  fallback,
  className = '',
}: VipLiveWeatherWidgetProps) {
  const queryCity = useMemo(() => {
    const fromDestination = extractWeatherCity(destination)
    if (fromDestination) return fromDestination
    return fallback?.destination?.trim() ?? ''
  }, [destination, fallback])

  const [data, setData] = useState<DayWeatherApiPayload | null>(() =>
    queryCity && fallback ? forecastToPayload(queryCity, fallback) : null,
  )
  const [loading, setLoading] = useState(Boolean(queryCity))

  useEffect(() => {
    if (!queryCity) {
      setLoading(false)
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch(`/api/weather?city=${encodeURIComponent(queryCity)}`)
        if (!res.ok) throw new Error('weather fetch failed')
        const json = (await res.json()) as DayWeatherApiPayload
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled && fallback) {
          setData(forecastToPayload(queryCity, fallback))
        } else if (!cancelled) {
          setData({
            city: queryCity,
            date: null,
            temp: 22,
            tempMin: 18,
            tempMax: 26,
            condition: 'طقس معتدل',
            icon: 'partly',
            emoji: weatherEmoji('partly'),
            source: 'placeholder',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [queryCity, fallback])

  if (!queryCity) return null

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#1E2720] via-[#232d26] to-[#181f1a] px-4 py-4 shadow-[0_10px_36px_rgba(0,0,0,0.28)] sm:px-5 ${className}`}
      aria-label={`طقس ${queryCity}`}
      dir="rtl"
    >
      <div
        className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#D4AF37]/12 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-[#D4AF37]/8 blur-2xl"
        aria-hidden
      />

      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 sm:h-14 sm:w-14">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" aria-hidden />
          ) : data ? (
            <WeatherIcon code={data.icon} large />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]/85">
              الطقس الآن
            </p>
            {data && !loading ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/45">
                {sourceLabel(data.source)}
              </span>
            ) : null}
          </div>
          {loading ? (
            <p className="mt-1 text-sm font-semibold text-white/55">جاري تحميل الطقس…</p>
          ) : data ? (
            <>
              <p className="mt-0.5 truncate text-base font-black text-white sm:text-lg">
                {data.city}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/55">{data.condition}</p>
            </>
          ) : null}
        </div>

        {data && !loading ? (
          <div className="shrink-0 text-end">
            <p className="text-3xl font-black leading-none text-[#D4AF37] sm:text-4xl" dir="ltr">
              {data.temp}°
            </p>
            <p className="mt-1 text-[10px] font-bold text-white/40" dir="ltr">
              {data.tempMin}° – {data.tempMax}°
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** @deprecated استخدم VipLiveWeatherWidget */
export { default as VipDayWeatherWidget } from './VipLiveWeatherWidget'
