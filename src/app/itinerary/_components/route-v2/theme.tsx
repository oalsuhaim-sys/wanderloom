'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

export type ItineraryTheme = 'dark' | 'light'

const STORAGE_KEY = 'wl-itinerary-theme'
const listeners = new Set<() => void>()
/** In-memory value for browsers where storage is blocked (private mode etc.). */
let memoryTheme: ItineraryTheme | null = null

function systemTheme(): ItineraryTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Saved choice → otherwise the phone's own setting. */
function readTheme(): ItineraryTheme {
  if (memoryTheme) return memoryTheme
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked */
  }
  return systemTheme()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  let mq: MediaQueryList | null = null
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', cb)
  } catch {
    mq = null
  }
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
    mq?.removeEventListener?.('change', cb)
  }
}

export function setItineraryTheme(next: ItineraryTheme) {
  memoryTheme = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable — the in-memory value still applies */
  }
  listeners.forEach((l) => l())
}

/** The client's chosen theme, remembered on this device (first visit follows the phone). */
export function useItineraryTheme(): ItineraryTheme {
  return useSyncExternalStore(subscribe, readTheme, () => 'light')
}

/** Small segmented switch: داكن / فاتح. */
export function ThemeToggle({ theme, className = '', labels = false }: { theme: ItineraryTheme; className?: string; labels?: boolean }) {
  const item = (value: ItineraryTheme, label: string, Icon: typeof Sun) => {
    const active = theme === value
    return (
      <button
        type="button"
        onClick={() => setItineraryTheme(value)}
        aria-pressed={active}
        aria-label={`المظهر ${label}`}
        title={`المظهر ${label}`}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold sm:px-3 transition-all duration-200 active:scale-95"
        style={{
          background: active ? 'var(--rv-gold)' : 'transparent',
          color: active ? 'var(--rv-on-gold)' : 'var(--rv-text-2)',
        }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className={labels ? undefined : 'hidden sm:inline'}>{label}</span>
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label="مظهر الصفحة"
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur-md ${className}`}
      style={{
        borderColor: 'var(--rv-line-strong)',
        background: 'var(--rv-glass-strong)',
      }}
    >
      {item('light', 'فاتح', Sun)}
      {item('dark', 'داكن', Moon)}
    </div>
  )
}
