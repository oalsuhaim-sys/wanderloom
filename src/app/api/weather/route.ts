import { NextResponse } from 'next/server'

export type DayWeatherApiPayload = {
  city: string
  temp: number
  tempMin: number
  tempMax: number
  condition: string
  icon: string
  source: 'openweather' | 'open-meteo' | 'placeholder'
}

function placeholderWeather(city: string): DayWeatherApiPayload {
  const hash = city.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const base = 18 + (hash % 12)
  return {
    city,
    temp: base + 2,
    tempMin: base,
    tempMax: base + 5,
    condition: 'مشمس جزئياً',
    icon: 'partly',
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

function mapIconCode(main: string): string {
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

function mapWmoIcon(code: number): string {
  if (code === 0) return 'clear'
  if (code === 1 || code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code === 45 || code === 48) return 'cloud'
  return 'partly'
}

async function fetchOpenMeteoWeather(city: string): Promise<DayWeatherApiPayload | null> {
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geoUrl.searchParams.set('name', city)
  geoUrl.searchParams.set('count', '1')
  geoUrl.searchParams.set('language', 'ar')
  geoUrl.searchParams.set('format', 'json')

  const geoRes = await fetch(geoUrl.toString(), { next: { revalidate: 3600 } })
  if (!geoRes.ok) return null

  const geo = (await geoRes.json()) as {
    results?: Array<{ name?: string; latitude?: number; longitude?: number }>
  }
  const hit = geo.results?.[0]
  if (!hit || hit.latitude == null || hit.longitude == null) return null

  const wxUrl = new URL('https://api.open-meteo.com/v1/forecast')
  wxUrl.searchParams.set('latitude', String(hit.latitude))
  wxUrl.searchParams.set('longitude', String(hit.longitude))
  wxUrl.searchParams.set('current', 'temperature_2m,weather_code')
  wxUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min')
  wxUrl.searchParams.set('forecast_days', '1')
  wxUrl.searchParams.set('timezone', 'auto')

  const wxRes = await fetch(wxUrl.toString(), { next: { revalidate: 1800 } })
  if (!wxRes.ok) return null

  const wx = (await wxRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number }
    daily?: { temperature_2m_min?: number[]; temperature_2m_max?: number[] }
  }

  const code = wx.current?.weather_code ?? 0
  const temp = Math.round(Number(wx.current?.temperature_2m ?? 20))
  const tempMin = Math.round(Number(wx.daily?.temperature_2m_min?.[0] ?? temp - 2))
  const tempMax = Math.round(Number(wx.daily?.temperature_2m_max?.[0] ?? temp + 2))

  return {
    city: hit.name?.trim() || city,
    temp,
    tempMin,
    tempMax,
    condition: mapWmoCondition(code),
    icon: mapWmoIcon(code),
    source: 'open-meteo',
  }
}

async function fetchOpenWeather(city: string, apiKey: string): Promise<DayWeatherApiPayload | null> {
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

  return {
    city: data.name?.trim() || city,
    temp,
    tempMin,
    tempMax,
    condition: mapOpenWeatherCondition(main, w0?.description ?? ''),
    icon: mapIconCode(main),
    source: 'openweather',
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = (searchParams.get('city') ?? searchParams.get('q') ?? '').trim()

  if (!city) {
    return NextResponse.json({ error: 'city required' }, { status: 400 })
  }

  const apiKey =
    process.env.OPENWEATHER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY?.trim() ||
    ''

  try {
    if (apiKey) {
      const openWeather = await fetchOpenWeather(city, apiKey)
      if (openWeather) return NextResponse.json(openWeather)
    }

    const openMeteo = await fetchOpenMeteoWeather(city)
    if (openMeteo) return NextResponse.json(openMeteo)
  } catch {
    // fall through to placeholder
  }

  return NextResponse.json(placeholderWeather(city))
}
