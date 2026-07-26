/** أنواع وأيقونات الطقس المشتركة (آمنة للعميل والخادم) */

export type WeatherIconCode =
  | 'clear'
  | 'partly'
  | 'cloud'
  | 'rain'
  | 'storm'
  | 'snow'

export type DayWeatherPayload = {
  city: string
  date: string | null
  temp: number
  tempMin: number
  tempMax: number
  condition: string
  icon: WeatherIconCode
  emoji: string
  source: 'openweather' | 'open-meteo' | 'placeholder'
}

/** @deprecated استخدم DayWeatherPayload */
export type DayWeatherApiPayload = DayWeatherPayload

export function weatherEmoji(icon: string): string {
  switch (icon) {
    case 'clear':
      return '☀️'
    case 'rain':
      return '🌧️'
    case 'storm':
      return '⛈️'
    case 'snow':
      return '❄️'
    case 'cloud':
      return '☁️'
    case 'partly':
    default:
      return '⛅'
  }
}

export function extractWeatherCity(destination: string): string {
  const trimmed = destination.trim()
  if (!trimmed) return ''
  const parts = trimmed
    .split(/[,،|/·]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts[0] ?? trimmed
}

/** YYYY-MM-DD ليوم المسار من تاريخ البداية */
export function isoDateForItineraryDay(
  startDate: string | null | undefined,
  dayIndex: number,
): string | null {
  if (!startDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate).trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dayIndex)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}
