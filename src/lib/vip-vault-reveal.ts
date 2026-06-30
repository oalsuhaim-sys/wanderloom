const MS_24H = 24 * 60 * 60 * 1000

/** بداية يوم انطلاق الرحلة (منتصف الليل محلياً) */
export function parseTripStartDate(isoDate: string | null | undefined): Date | null {
  if (!isoDate?.trim()) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const start = new Date(y, mo, d, 0, 0, 0, 0)
  return Number.isNaN(start.getTime()) ? null : start
}

/** لحظة فتح الخزنة: 24 ساعة قبل بداية الرحلة */
export function getVaultUnlockAt(startDate: string | null | undefined): Date | null {
  const tripStart = parseTripStartDate(startDate)
  if (!tripStart) return null
  return new Date(tripStart.getTime() - MS_24H)
}

export type VipScheduleLockOptions = {
  /** من itineraries.bypass_24h_lock — فتح فوري للعميل */
  bypass24hLock?: boolean | null
  now?: Date
}

/** يقرأ bypass_24h_lock من صف Supabase أو كائن عام */
export function parseBypass24hLock(raw: unknown): boolean {
  if (raw === true || raw === 1) return true
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    return s === 'true' || s === 't' || s === '1' || s === 'yes'
  }
  return false
}

/** الوقت المتبقي حتى بداية الرحلة (مللي ثانية) — null إن لم يُحدد تاريخ */
export function getTimeUntilTripStartMs(
  startDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const tripStart = parseTripStartDate(startDate)
  if (!tripStart) return null
  return tripStart.getTime() - now.getTime()
}

/**
 * فتح واجهة العميل: bypass صريح true، أو بقاء ≤24 ساعة على الانطلاق.
 * null/undefined/false لـ bypass_24h_lock تُعامل كـ false.
 * بدون start_date نفتح المسار (مسارات قديمة).
 */
export function isVipClientItineraryUnlocked(
  startDate: string | null | undefined,
  bypass24hLock: boolean | null | undefined,
  now: Date = new Date(),
): boolean {
  if (bypass24hLock === true) return true

  const timeUntilStart = getTimeUntilTripStartMs(startDate, now)
  if (timeUntilStart == null) return true

  return timeUntilStart <= MS_24H
}

/**
 * true = إخفاء المسار اليومي والمفاجآت (خزنة VIP).
 * عكس isVipClientItineraryUnlocked.
 */
export function isVipScheduleLocked(
  startDate: string | null | undefined,
  options?: VipScheduleLockOptions | Date,
): boolean {
  const opts: VipScheduleLockOptions =
    options instanceof Date ? { now: options } : (options ?? {})
  const bypass =
    opts.bypass24hLock === true
      ? true
      : opts.bypass24hLock === false
        ? false
        : parseBypass24hLock(opts.bypass24hLock)

  return !isVipClientItineraryUnlocked(startDate, bypass, opts.now)
}

export type VaultCountdownParts = {
  days: number
  hours: number
  minutes: number
  totalMs: number
}

export function getVaultCountdownParts(
  unlockAt: Date,
  now: Date = new Date(),
): VaultCountdownParts {
  const diff = Math.max(0, unlockAt.getTime() - now.getTime())
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return { days, hours, minutes, totalMs: diff }
}
