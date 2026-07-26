import { NextResponse } from 'next/server'

import { getDayWeather } from '@/lib/weather-server'
import type { DayWeatherPayload } from '@/lib/weather'

export type { DayWeatherPayload as DayWeatherApiPayload }

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = (searchParams.get('city') ?? searchParams.get('q') ?? '').trim()
  const date = (searchParams.get('date') ?? '').trim() || null

  if (!city) {
    return NextResponse.json({ error: 'city required' }, { status: 400 })
  }

  const payload: DayWeatherPayload = await getDayWeather({ city, date })
  return NextResponse.json(payload)
}
