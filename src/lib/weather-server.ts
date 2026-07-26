import 'server-only'

import {
  isIsoDate,
  weatherEmoji,
  type DayWeatherPayload,
  type WeatherIconCode,
} from '@/lib/weather'

function placeholderWeather(city: string, date: string | null): DayWeatherPayload {
  const hash = `${city}:${date ?? ''}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = 18 + (hash % 12)
  const icon: WeatherIconCode = 'partly'
  return {
    city,
    date,
    temp: base + 2,
    tempMin: base,
    tempMax: base + 5,
    condition: 'مشمس جزئياً',
    icon,
    emoji: weatherEmoji(icon),
    source: 'placeholder',
  }
}

function mapOpenWeatherCondition(main: string, description: string): string {
  const m = main.toLowerCase()
  if (m.includes('clear')) return 'صافٍ'
  if (m.includes('cloud')) return 'غائم جزئياً'
  if (m.includes('rain') || m.includes('drizzle')) return 'أمطار خفيفة'
  if (m.includes('thunder')) return 'عواصف رعدية'
  if (m.includes('snow')) return 'ثلوج'
  if (m.includes('mist') || m.includes('fog')) return 'ضباب خفيف'
  return description || 'معتدل'
}

function mapIconCode(main: string): WeatherIconCode {
  const m = main.toLowerCase()
  if (m.includes('clear')) return 'clear'
  if (m.includes('rain') || m.includes('drizzle')) return 'rain'
  if (m.includes('thunder')) return 'storm'
  if (m.includes('snow')) return 'snow'
  if (m.includes('cloud')) return 'cloud'
  return 'partly'
}

function mapWmoCondition(code: number): string {
  if (code === 0) return 'صافٍ'
  if (code === 1) return 'صافٍ غالباً'
  if (code === 2) return 'غائم جزئياً'
  if (code === 3) return 'غائم'
  if (code === 45 || code === 48) return 'ضباب'
  if (code >= 51 && code <= 57) return 'رذاذ خفيف'
  if (code >= 61 && code <= 67) return 'أمطار'
  if (code >= 71 && code <= 77) return 'ثلوج'
  if (code >= 80 && code <= 82) return 'زخات مطر'
  if (code >= 85 && code <= 86) return 'زخات ثلج'
  if (code >= 95 && code <= 99) return 'عواصف رعدية'
  return 'معتدل'
}

function mapWmoIcon(code: number): WeatherIconCode {
  if (code === 0) return 'clear'
  if (code === 1 || code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code === 45 || code === 48) return 'cloud'
  return 'partly'
}

type GeoHit = { name: string; latitude: number; longitude: number }

async function geocodeCity(city: string): Promise<GeoHit | null> {
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geoUrl.searchParams.set('name', city)
  geoUrl.searchParams.set('count', '1')
  geoUrl.searchParams.set('language', 'ar')
  geoUrl.searchParams.set('format', 'json')

  const geoRes = await fetch(geoUrl.toString(), { next: { revalidate: 86400 } })
  if (!geoRes.ok) return null

  const geo = (await geoRes.json()) as {
    results?: Array<{ name?: string; latitude?: number; longitude?: number }>
  }
  const hit = geo.results?.[0]
  if (!hit || hit.latitude == null || hit.longitude == null) return null
  return {
    name: hit.name?.trim() || city,
    latitude: hit.latitude,
    longitude: hit.longitude,
  }
}

type DailyWx = {
  weather_code?: number[]
  temperature_2m_min?: number[]
  temperature_2m_max?: number[]
  time?: string[]
}

function payloadFromDaily(
  cityName: string,
  date: string,
  daily: DailyWx,
  source: DayWeatherPayload['source'],
): DayWeatherPayload | null {
  const times = daily.time ?? []
  const idx = times.findIndex((t) => t === date)
  const i = idx >= 0 ? idx : 0
  if (!times.length && daily.temperature_2m_max == null) return null

  const code = Number(daily.weather_code?.[i] ?? 2)
  const tempMin = Math.round(Number(daily.temperature_2m_min?.[i] ?? 18))
  const tempMax = Math.round(Number(daily.temperature_2m_max?.[i] ?? tempMin + 4))
  const temp = Math.round((tempMin + tempMax) / 2)
  const icon = mapWmoIcon(code)

  return {
    city: cityName,
    date,
    temp,
    tempMin,
    tempMax,
    condition: mapWmoCondition(code),
    icon,
    emoji: weatherEmoji(icon),
    source,
  }
}

async function fetchOpenMeteoDaily(
  geo: GeoHit,
  date: string,
): Promise<DayWeatherPayload | null> {
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const target = new Date(`${date}T12:00:00`)
  const todayDate = new Date(`${todayIso}T12:00:00`)
  const diffDays = Math.round((target.getTime() - todayDate.getTime()) / 86400000)

  // توقعات حتى ~16 يوماً
  if (diffDays >= 0 && diffDays <= 16) {
    const wxUrl = new URL('https://api.open-meteo.com/v1/forecast')
    wxUrl.searchParams.set('latitude', String(geo.latitude))
    wxUrl.searchParams.set('longitude', String(geo.longitude))
    wxUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
    wxUrl.searchParams.set('start_date', date)
    wxUrl.searchParams.set('end_date', date)
    wxUrl.searchParams.set('timezone', 'auto')

    const wxRes = await fetch(wxUrl.toString(), { next: { revalidate: 1800 } })
    if (wxRes.ok) {
      const wx = (await wxRes.json()) as { daily?: DailyWx }
      const payload = wx.daily ? payloadFromDaily(geo.name, date, wx.daily, 'open-meteo') : null
      if (payload) return payload
    }
  }

  // أرشيف / مناخ تقريبي (نفس اليوم من العام الماضي للرحلات البعيدة أو الماضية)
  let archiveDate = date
  if (diffDays > 16) {
    const y = Number(date.slice(0, 4)) - 1
    archiveDate = `${y}${date.slice(4)}`
  }

  const archiveUrl = new URL('https://archive-api.open-meteo.com/v1/archive')
  archiveUrl.searchParams.set('latitude', String(geo.latitude))
  archiveUrl.searchParams.set('longitude', String(geo.longitude))
  archiveUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
  archiveUrl.searchParams.set('start_date', archiveDate)
  archiveUrl.searchParams.set('end_date', archiveDate)
  archiveUrl.searchParams.set('timezone', 'auto')

  const archiveRes = await fetch(archiveUrl.toString(), { next: { revalidate: 86400 } })
  if (!archiveRes.ok) return null

  const archive = (await archiveRes.json()) as { daily?: DailyWx }
  if (!archive.daily) return null
  const payload = payloadFromDaily(geo.name, date, archive.daily, 'open-meteo')
  return payload
}

async function fetchOpenMeteoCurrent(geo: GeoHit): Promise<DayWeatherPayload | null> {
  const wxUrl = new URL('https://api.open-meteo.com/v1/forecast')
  wxUrl.searchParams.set('latitude', String(geo.latitude))
  wxUrl.searchParams.set('longitude', String(geo.longitude))
  wxUrl.searchParams.set('current', 'temperature_2m,weather_code')
  wxUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code')
  wxUrl.searchParams.set('forecast_days', '1')
  wxUrl.searchParams.set('timezone', 'auto')

  const wxRes = await fetch(wxUrl.toString(), { next: { revalidate: 1800 } })
  if (!wxRes.ok) return null

  const wx = (await wxRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number }
    daily?: DailyWx
  }

  const code = wx.current?.weather_code ?? wx.daily?.weather_code?.[0] ?? 0
  const temp = Math.round(Number(wx.current?.temperature_2m ?? 20))
  const tempMin = Math.round(Number(wx.daily?.temperature_2m_min?.[0] ?? temp - 2))
  const tempMax = Math.round(Number(wx.daily?.temperature_2m_max?.[0] ?? temp + 2))
  const icon = mapWmoIcon(code)

  return {
    city: geo.name,
    date: null,
    temp,
    tempMin,
    tempMax,
    condition: mapWmoCondition(code),
    icon,
    emoji: weatherEmoji(icon),
    source: 'open-meteo',
  }
}

async function fetchOpenWeatherCurrent(
  city: string,
  apiKey: string,
): Promise<DayWeatherPayload | null> {
  const url = new URL('https://api.openweathermap.org/data/2.5/weather')
  url.searchParams.set('q', city)
  url.searchParams.set('units', 'metric')
  url.searchParams.set('lang', 'ar')
  url.searchParams.set('appid', apiKey)

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
  if (!res.ok) return null

  const data = (await res.json()) as {
    name?: string
    main?: { temp?: number; temp_min?: number; temp_max?: number }
    weather?: Array<{ main?: string; description?: string }>
  }

  const w0 = data.weather?.[0]
  const main = w0?.main ?? 'Clouds'
  const temp = Math.round(Number(data.main?.temp ?? 20))
  const tempMin = Math.round(Number(data.main?.temp_min ?? temp - 2))
  const tempMax = Math.round(Number(data.main?.temp_max ?? temp + 2))
  const icon = mapIconCode(main)

  return {
    city: data.name?.trim() || city,
    date: null,
    temp,
    tempMin,
    tempMax,
    condition: mapOpenWeatherCondition(main, w0?.description ?? ''),
    icon,
    emoji: weatherEmoji(icon),
    source: 'openweather',
  }
}

export type GetDayWeatherInput = {
  city: string
  date?: string | null
}

/**
 * جلب طقس مدينة — اختياريًا لتاريخ محدد (توقعات / أرشيف Open-Meteo).
 * المفاتيح تبقى على الخادم فقط.
 */
export async function getDayWeather(
  input: GetDayWeatherInput,
): Promise<DayWeatherPayload> {
  const city = String(input.city ?? '').trim()
  const dateRaw = String(input.date ?? '').trim()
  const date = dateRaw && isIsoDate(dateRaw) ? dateRaw : null

  if (!city) {
    return placeholderWeather('—', date)
  }

  const apiKey =
    process.env.OPENWEATHER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY?.trim() ||
    ''

  try {
    if (!date && apiKey) {
      const openWeather = await fetchOpenWeatherCurrent(city, apiKey)
      if (openWeather) return openWeather
    }

    const geo = await geocodeCity(city)
    if (geo) {
      if (date) {
        const daily = await fetchOpenMeteoDaily(geo, date)
        if (daily) return daily
      } else {
        const current = await fetchOpenMeteoCurrent(geo)
        if (current) return current
      }
    }
  } catch (err) {
    console.warn('[weather-server]', err)
  }

  return placeholderWeather(city, date)
}
