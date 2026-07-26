'use server'

import { getDayWeather } from '@/lib/weather-server'
import type { DayWeatherPayload } from '@/lib/weather'

export type GetWeatherActionResult =
  | { ok: true; data: DayWeatherPayload }
  | { ok: false; error: string }

/** Server Action — طقس يوم الرحلة بدون كشف مفاتيح API */
export async function getWeatherAction(
  city: string,
  date?: string | null,
): Promise<GetWeatherActionResult> {
  const q = String(city ?? '').trim()
  if (!q) {
    return { ok: false, error: 'city required' }
  }

  try {
    const data = await getDayWeather({ city: q, date: date ?? null })
    return { ok: true, data }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر جلب الطقس',
    }
  }
}
