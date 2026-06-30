import type { PublicItinerary } from '@/lib/public-itinerary'

const STORAGE_PREFIX = 'wanderloom-itinerary-cache-v1'
const UNLOCK_PREFIX = 'wanderloom-itinerary-unlock-v1'

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

export function persistItineraryUnlock(slug: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(unlockKey(slug), '1')
  } catch {
    /* quota / private mode */
  }
}

export function hasItineraryUnlock(slug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(unlockKey(slug)) === '1'
  } catch {
    return false
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
    await navigator.serviceWorker.register('/itinerary-sw.js', { scope: '/itinerary/' })
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
    /* dynamic route may not cache as static document — trip JSON in localStorage is primary */
  }
}
