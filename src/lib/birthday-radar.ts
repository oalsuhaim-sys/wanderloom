/**
 * Birthday / anniversary helpers for CRM radar widgets.
 * All date parsing is null-safe — never throws on missing/invalid values.
 */

export type BirthdayRadarClient = {
  id: string
  name: string
  birth_date: string
  daysUntilBirthday: number
  phone_wa: string
}

export type AnniversaryRadarClient = {
  id: string
  name: string
  anniversary_date: string
  daysUntilAnniversary: number
  phone_wa: string
}

function parseBirthDateLocal(raw: unknown): Date | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    const date = new Date(y, m - 1, d)
    if (Number.isNaN(date.getTime())) return null
    // Reject overflow (e.g. 2020-02-31 → March)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      return null
    }
    return date
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getDaysUntilRecurringDate(
  dateRaw: unknown,
  today: Date = new Date(),
): number | null {
  const parsed = parseBirthDateLocal(dateRaw)
  if (!parsed) return null

  const todayNorm = new Date(today)
  todayNorm.setHours(0, 0, 0, 0)

  const next = new Date(todayNorm.getFullYear(), parsed.getMonth(), parsed.getDate())
  next.setHours(0, 0, 0, 0)

  if (next < todayNorm) {
    next.setFullYear(todayNorm.getFullYear() + 1)
  }

  const diffTime = next.getTime() - todayNorm.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getDaysUntilBirthday(
  birthDateRaw: unknown,
  today: Date = new Date(),
): number | null {
  return getDaysUntilRecurringDate(birthDateRaw, today)
}

/** True when the next birthday falls within the next `horizonDays` (inclusive). */
export function isBirthdaySoon(
  birthDateRaw: unknown,
  horizonDays = 7,
  today: Date = new Date(),
): boolean {
  const daysLeft = getDaysUntilBirthday(birthDateRaw, today)
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= horizonDays
}

export function filterUpcomingBirthdays(
  clients: Array<Record<string, unknown>>,
  horizonDays = 7,
  referenceDate = new Date(),
): BirthdayRadarClient[] {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  const upcoming = clients
    .map((client) => {
      const birth_date = String(client.birth_date ?? '').trim()
      if (!birth_date) return null

      const daysUntilBirthday = getDaysUntilBirthday(birth_date, today)
      if (
        daysUntilBirthday == null ||
        daysUntilBirthday < 0 ||
        daysUntilBirthday > horizonDays
      ) {
        return null
      }

      const name =
        String(client.name ?? '').trim() || `عميل #${client.id}`

      return {
        id: String(client.id),
        name,
        birth_date,
        daysUntilBirthday,
        phone_wa: String(client.phone_wa ?? '').trim(),
      }
    })
    .filter((row): row is BirthdayRadarClient => row != null)

  upcoming.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)
  return upcoming
}

export function filterUpcomingAnniversaries(
  clients: Array<Record<string, unknown>>,
  horizonDays = 7,
  referenceDate = new Date(),
): AnniversaryRadarClient[] {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  const upcoming = clients
    .map((client) => {
      const anniversary_date = String(client.anniversary_date ?? '').trim()
      if (!anniversary_date) return null

      const daysUntilAnniversary = getDaysUntilRecurringDate(anniversary_date, today)
      if (
        daysUntilAnniversary == null ||
        daysUntilAnniversary < 0 ||
        daysUntilAnniversary > horizonDays
      ) {
        return null
      }

      const name =
        String(client.name ?? '').trim() || `عميل #${client.id}`

      return {
        id: String(client.id),
        name,
        anniversary_date,
        daysUntilAnniversary,
        phone_wa: String(client.phone_wa ?? '').trim(),
      }
    })
    .filter((row): row is AnniversaryRadarClient => row != null)

  upcoming.sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary)
  return upcoming
}

/** Safe Arabic month/day label — never throws; returns em-dash when invalid. */
export function formatBirthdayDisplayDate(birthDateRaw: unknown): string {
  if (birthDateRaw == null) return '—'
  const raw = String(birthDateRaw).trim()
  if (!raw) return '—'
  const birth = parseBirthDateLocal(raw)
  if (!birth) {
    const iso = raw.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? iso.slice(5).split('-').reverse().join('/')
      : '—'
  }
  try {
    return birth.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })
  } catch {
    const m = String(birth.getMonth() + 1).padStart(2, '0')
    const d = String(birth.getDate()).padStart(2, '0')
    return `${d}/${m}`
  }
}

/** Alias used by newer call sites */
export function formatBirthDayMonth(birthDateIso: unknown): string {
  return formatBirthdayDisplayDate(birthDateIso)
}
