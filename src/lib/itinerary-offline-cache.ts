import type { PublicItinerary } from '@/lib/public-itinerary'

const STORAGE_PREFIX = 'wanderloom-itinerary-cache-v1'
const UNLOCK_PREFIX = 'wanderloom-itinerary-unlock-v1'

/** مفتاح الرحلة العام — يُحفظ بعد تسجيل دخول ناجح في البوابة أو مسار VIP */
export const WANDERLOOM_ACCESS_KEY_STORAGE = 'wanderloom_access_key'

type CachedItineraryPayload = {
  version: 1
  slug: string
  cachedAt: number
  trip: PublicItinerary
}

function storageKey(slug: string) {
  return `${STORAGE_PREFIX}:${slug.trim()}`
}

function unlockKey(slug: string) {
  return `${UNLOCK_PREFIX}:${slug.trim()}`
}

export function persistWanderloomAccessKey(key: string) {
  if (typeof window === 'undefined') return
  const normalized = key.trim().toUpperCase()
  if (!normalized) return
  try {
    localStorage.setItem(WANDERLOOM_ACCESS_KEY_STORAGE, normalized)
  } catch {
    /* quota / private mode */
  }
}

export function loadWanderloomAccessKey(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WANDERLOOM_ACCESS_KEY_STORAGE)
    const normalized = raw?.trim().toUpperCase()
    return normalized || null
  } catch {
    return null
  }
}

export function clearWanderloomAccessKey() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(WANDERLOOM_ACCESS_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}

export function passcodeMatchesAccessKey(expected: string, input?: string): boolean {
  const pin = (input ?? loadWanderloomAccessKey() ?? '').trim().toUpperCase()
  const expectedNorm = expected.trim().toUpperCase()
  return !!pin && !!expectedNorm && pin === expectedNorm
}

export function persistItineraryUnlock(slug: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(unlockKey(slug), '1')
  } catch {
    /* quota / private mode */
  }
}

export function hasItineraryUnlock(slug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(unlockKey(slug)) === '1'
  } catch {
    return false
  }
}

export function clearItineraryUnlock(slug: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(unlockKey(slug))
  } catch {
    /* ignore */
  }
}

export function persistItineraryCache(slug: string, trip: PublicItinerary) {
  if (typeof window === 'undefined') return
  const payload: CachedItineraryPayload = {
    version: 1,
    slug: slug.trim(),
    cachedAt: Date.now(),
    trip,
  }
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

export function loadCachedItinerary(slug: string): PublicItinerary | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedItineraryPayload
    if (!parsed?.trip || parsed.version !== 1) return null
    return parsed.trip
  } catch {
    return null
  }
}

export async function registerItineraryServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing?.active?.scriptURL.includes('sw.js')) return
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('[itinerary-pwa] service worker registration failed', err)
  }
}

export async function warmItineraryOfflineAssets(slug: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return
  const path = `/itinerary/${encodeURIComponent(slug.trim())}`
  try {
    const cache = await caches.open('wanderloom-itinerary-pages-v1')
    await cache.add(path)
  } catch {
    /* shell may be served by next-pwa runtime cache — trip JSON in localStorage is primary */
  }
}

export function hydrateTripFromOfflineCache(
  slug: string,
  options?: { requireUnlock?: boolean },
): PublicItinerary | null {
  if (options?.requireUnlock && !hasItineraryUnlock(slug)) return null
  return loadCachedItinerary(slug)
}
