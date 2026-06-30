import type { SupabaseClient } from '@supabase/supabase-js'

import { parseDnaInterests } from '@/lib/clientsTravelDna'

/** ربط اهتمامات DNA العربية بوسوم/تصنيفات الفعاليات (عربي + إنجليزي) */
export const DNA_INTEREST_EVENT_TAG_MAP: Record<string, string[]> = {
  التسوق: ['shopping', 'shop', 'retail', 'fashion', 'luxury', 'تسوق', 'موضة', 'أزياء', 'مول'],
  العيادات: ['clinic', 'clinics', 'medical', 'wellness', 'health', 'spa', 'عيادات', 'طب', 'علاج'],
  الفعاليات: ['event', 'events', 'festival', 'festivals', 'fair', 'فعاليات', 'مهرجان', 'موسم'],
  التاريخ: ['history', 'historical', 'heritage', 'historic', 'تاريخ', 'حضارة', 'أثري'],
  الطبيعة: ['nature', 'outdoor', 'scenic', 'landscape', 'hiking', 'طبيعة', 'مناظر', 'جبال'],
  الفن: ['art', 'arts', 'museum', 'museums', 'gallery', 'exhibition', 'فن', 'معارض', 'متاحف'],
  المطاعم: ['food', 'dining', 'culinary', 'gastronomy', 'restaurant', 'مطاعم', 'طعام', 'مأكولات'],
  السبا: ['spa', 'wellness', 'relaxation', 'massage', 'سبا', 'استرخاء'],
  الثقافة: ['cultural', 'culture', 'tradition', 'ثقافة', 'تراث'],
  الرياضة: ['sport', 'sports', 'athletic', 'رياضة', 'ماراثون', 'بطولة'],
  // مرادفات شائعة من النموذج القديم
  تسوق: ['shopping', 'retail', 'fashion', 'تسوق'],
  طبيعة: ['nature', 'outdoor', 'طبيعة'],
  فن: ['art', 'museum', 'فن'],
  تاريخ: ['history', 'cultural', 'heritage', 'تاريخ'],
}

export type CrmEventRow = {
  id: number
  name: string | null
  country: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  season: string | null
  category: string | null
  impact?: string | null
  season_tags?: string[] | null
}

export type DnaMatchedEvent = CrmEventRow & {
  matchedTags: string[]
  matchedInterests: string[]
}

function normToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isObstacleImpact(impact: string | null | undefined): boolean {
  const v = normToken(String(impact ?? ''))
  if (!v) return false
  return (
    v === 'obstacle' ||
    v.includes('avoid') ||
    v.includes('تجنب') ||
    v.includes('تجنّب')
  )
}

/** فعاليات إيجابية فقط — feature / اذهب / فارغ */
export function isPositiveEventImpact(impact: string | null | undefined): boolean {
  return !isObstacleImpact(impact)
}

function expandInterestTokens(interest: string): string[] {
  const raw = interest.trim()
  if (!raw) return []
  const n = normToken(raw)

  let mapped: string[] = DNA_INTEREST_EVENT_TAG_MAP[raw] ?? []

  if (!mapped.length) {
    for (const [key, tags] of Object.entries(DNA_INTEREST_EVENT_TAG_MAP)) {
      const kn = normToken(key)
      if (kn === n || n.includes(kn) || kn.includes(n)) {
        mapped = [...mapped, ...tags]
      }
    }
  }

  return [n, ...mapped.map(normToken)].filter(Boolean)
}

function eventSearchTokens(event: CrmEventRow): string[] {
  const tags = Array.isArray(event.season_tags)
    ? event.season_tags.map((t) => normToken(String(t)))
    : []
  const parts = [
    event.category,
    event.season,
    event.name,
    event.city,
    event.country,
    ...tags,
  ]
  return parts.map((p) => normToken(String(p ?? ''))).filter(Boolean)
}

function tokensOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true
  return false
}

export function matchEventToDnaInterests(
  event: CrmEventRow,
  dnaInterests: string[],
): { matched: boolean; matchedTags: string[]; matchedInterests: string[] } {
  if (!isPositiveEventImpact(event.impact)) {
    return { matched: false, matchedTags: [], matchedInterests: [] }
  }

  const eventTokens = eventSearchTokens(event)
  if (!eventTokens.length || !dnaInterests.length) {
    return { matched: false, matchedTags: [], matchedInterests: [] }
  }

  const matchedInterests: string[] = []
  const matchedTags = new Set<string>()

  for (const interest of dnaInterests) {
    const interestTokens = expandInterestTokens(interest)
    if (!interestTokens.length) continue

    const hit = eventTokens.some((et) =>
      interestTokens.some((it) => tokensOverlap(et, it)),
    )
    if (!hit) continue

    matchedInterests.push(interest)
    for (const et of eventTokens) {
      if (interestTokens.some((it) => tokensOverlap(et, it))) {
        matchedTags.add(et)
      }
    }
  }

  return {
    matched: matchedInterests.length > 0,
    matchedTags: [...matchedTags],
    matchedInterests,
  }
}

export function filterDnaMatchedEvents(
  events: CrmEventRow[],
  dnaInterestsRaw: string | null | undefined,
): DnaMatchedEvent[] {
  const interests = parseDnaInterests(dnaInterestsRaw)
  if (!interests.length) return []

  const out: DnaMatchedEvent[] = []
  for (const event of events) {
    const { matched, matchedTags, matchedInterests } = matchEventToDnaInterests(event, interests)
    if (matched) {
      out.push({ ...event, matchedTags, matchedInterests })
    }
  }

  return out.sort((a, b) => {
    const ad = a.start_date ? Date.parse(a.start_date) : 0
    const bd = b.start_date ? Date.parse(b.start_date) : 0
    return bd - ad
  })
}

const EVENT_SELECT_WITH_TAGS =
  'id, name, country, city, start_date, end_date, season, category, impact, season_tags'

const EVENT_SELECT_FALLBACK =
  'id, name, country, city, start_date, end_date, season, category, impact'

export async function fetchDnaMatchedEvents(
  supabase: SupabaseClient,
  dnaInterestsRaw: string | null | undefined,
): Promise<DnaMatchedEvent[]> {
  const interests = parseDnaInterests(dnaInterestsRaw)
  if (!interests.length) return []

  const primary = await supabase
    .from('events')
    .select(EVENT_SELECT_WITH_TAGS)
    .order('start_date', { ascending: false })
    .limit(500)

  let rows: CrmEventRow[] = []

  if (primary.error) {
    const msg = String(primary.error.message ?? '')
    const missingCol =
      msg.includes('season_tags') ||
      msg.includes('impact') ||
      (primary.error as { code?: string }).code === '42703'
    if (!missingCol) throw primary.error

    const fallback = await supabase
      .from('events')
      .select(EVENT_SELECT_FALLBACK)
      .order('start_date', { ascending: false })
      .limit(500)
    if (fallback.error) throw fallback.error
    rows = ((fallback.data ?? []) as CrmEventRow[]).map((e) => ({ ...e, season_tags: [] }))
  } else {
    rows = (primary.data ?? []) as CrmEventRow[]
  }

  const positiveOnly = rows.filter((e) => isPositiveEventImpact(e.impact))
  return filterDnaMatchedEvents(positiveOnly, dnaInterestsRaw)
}

export function formatEventDateRange(start: string | null, end: string | null): string {
  const fmt = (d: string | null) => {
    if (!d) return ''
    const parsed = Date.parse(d)
    if (Number.isNaN(parsed)) return d
    return new Date(parsed).toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  const a = fmt(start)
  const b = fmt(end)
  if (a && b) return `${a} — ${b}`
  return a || b || '—'
}
