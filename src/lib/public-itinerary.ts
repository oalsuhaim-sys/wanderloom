import { placeBankCategoryLabel } from '@/lib/places-bank'
import { parseItineraryDocuments, type ItineraryDocument } from '@/lib/itinerary-documents'
import { parseActivityTickets, type ActivityTicket } from '@/lib/itinerary-tickets'
import { normalizeVipSpendingTier, type VipSpendingTier } from '@/lib/vip-spending-tier'
import { parseQuotationDetails, type QuotationDetails } from '@/lib/quotation-details'
import { supabase } from '@/lib/supabase'
import { parseBypass24hLock } from '@/lib/vip-vault-reveal'
import type { SupabaseClient } from '@supabase/supabase-js'

/** أعمدة مسموح جلبها للواجهة العامة — لا تكاليف ولا هوامش ولا ملاحظات داخلية */
export const PUBLIC_ITINERARY_SELECT = [
  'id',
  'magic_link_id',
  'title',
  'destination',
  'customer_name',
  'cover_image',
  'flight_details',
  'days_data',
  'dates',
  'passcode',
  'client_id',
  'highlights',
  'hotel_details',
  'experiences_details',
  'local_lingo',
  'weather_temp',
  'budget_options',
  'total_price',
  'total_budget',
  'spent_amount',
  'destination_story',
  'taxi_phrase',
  'secret_gem',
  'weather_summary',
  'packing_summary',
  'budget_summary',
  'flight_summary',
  'include_wardrobe',
  'documents',
  'ticket_details',
  'quotation_details',
  'is_quotation',
  'is_medical',
  'show_fashion_services',
  'total_estimated_cost',
  'expected_profit',
].join(', ')

export type PublicItineraryActivity = {
  id: string
  title: string
  /** اسم المكان من stop.place_name — للبحث في خرائط Google */
  place_name: string | null
  description: string
  /** قصة المحطة من stop.story / stop.description */
  story: string | null
  timeLabel: string
  imageUrl: string | null
  mapsQuery: string
  bookingUrl: string | null
  /** نص booking_url الخام من المحطة — للتحقق الشرطي في واجهة العميل */
  booking_url: string | null
  /** رابط Google Maps من stop.google_maps_url / maps_url */
  googleMapsUrl: string | null
  lat: number | null
  lng: number | null
  /** دقائق الانتقال من النشاط السابق */
  transitFromPreviousMinutes: number | null
  /** نص النقل: stop.transport_type / taxi / transit_time */
  transportLabel: string | null
  /** فئة بنك الأماكن — l,r,c,s,d,h,f,o */
  category: string | null
  categoryLabel: string | null
  /** مدينة · دولة إن وُجدت في المحطة */
  locationLabel: string | null
  transitMode: VipTransitIconKind | null
  transitDuration: string | null
}

export type PublicItineraryDay = {
  index: number
  title: string
  cityLabel: string
  tabLabel: string
  dateLabel: string
  mapsQuery: string
  /** فندق الإقامة لهذا اليوم — نقطة انطلاق/عودة على الجدول الزمني */
  hotelName?: string
  activities: PublicItineraryActivity[]
}

const PLACEHOLDER_ACTIVITY_TIMES = ['09:30', '12:00', '14:30', '17:00', '19:30', '21:00'] as const

function pickCoordinate(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = obj[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string' && raw.trim() !== '') {
      const n = Number(raw)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickLatLngFromRecord(obj: Record<string, unknown> | null): { lat: number; lng: number } | null {
  if (!obj) return null
  const lat = pickCoordinate(obj, [
    'lat',
    'latitude',
    'Lat',
    'place_lat',
    'geo_lat',
    'y',
  ])
  const lng = pickCoordinate(obj, [
    'lng',
    'lon',
    'longitude',
    'Lng',
    'long',
    'place_lng',
    'geo_lng',
    'x',
  ])
  if (lat != null && lng != null) return { lat, lng }

  const location = obj.location
  if (location && typeof location === 'object') {
    return pickLatLngFromRecord(location as Record<string, unknown>)
  }
  const coords = obj.coordinates
  if (coords && typeof coords === 'object') {
    return pickLatLngFromRecord(coords as Record<string, unknown>)
  }
  return null
}

function pickTimeLabel(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  return (
    pickStr(obj, [
      'visit_time',
      'time',
      'time_slot',
      'start_time',
      'scheduled_time',
      'activity_time',
      'leave_time',
      'departure_time',
    ]) || null
  )
}

/** وقت حقيقي من المحطة فقط — بدون أوقات وهمية للعميل */
function resolveActivityTimeLabel(obj: Record<string, unknown> | null): string {
  return pickTimeLabel(obj) || ''
}

export function buildUberDeepLink(
  dropoffAddress: string | null | undefined,
  options?: { useMyLocationPickup?: boolean },
): string {
  const address = (dropoffAddress ?? '').trim()
  if (!address) return 'uber://?action=setPickup'
  const pickupParam = options?.useMyLocationPickup ? '&pickup=my_location' : ''
  return `https://m.uber.com/ul/?action=setPickup${pickupParam}&dropoff[formatted_address]=${encodeURIComponent(address)}`
}

export function buildUberRouteDeepLink(
  pickupAddress: string | null | undefined,
  dropoffAddress: string | null | undefined,
): string {
  const pickup = (pickupAddress ?? '').trim()
  const dropoff = (dropoffAddress ?? '').trim()
  if (!dropoff && !pickup) return buildUberDeepLink('')
  if (!pickup) return buildUberDeepLink(dropoff, { useMyLocationPickup: true })
  if (!dropoff) return buildUberDeepLink(pickup, { useMyLocationPickup: true })
  return `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${encodeURIComponent(pickup)}&dropoff[formatted_address]=${encodeURIComponent(dropoff)}`
}

export function buildGoogleMapsDirectionsUrl(
  origin: string | null | undefined,
  destination: string | null | undefined,
): string {
  const from = (origin ?? '').trim()
  const to = (destination ?? '').trim()
  if (!from && !to) return buildGoogleMapsPlaceSearchUrl('')
  if (!from) return buildGoogleMapsPlaceSearchUrl(to)
  if (!to) return buildGoogleMapsPlaceSearchUrl(from)
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`
}

export type PublicWeatherForecast = {
  destination: string
  tempMin: number
  tempMax: number
  condition: string
}

export type PublicBudgetSummary = {
  total: number
  spent: number
  remaining: number
  currency: string
}

export type PublicDestinationDiscover = {
  destinationStory: string | null
  taxiPhrase: string | null
  secretGem: string | null
}

export type PublicItineraryHotel = {
  id: string
  name: string
  imageUrl: string | null
  checkIn: string | null
  checkOut: string | null
  bookingReference: string | null
  address: string | null
  mapsQuery: string
  bookingUrl: string | null
  city: string | null
  country: string | null
  category: string | null
  categoryLabel: string | null
  notes: string | null
}

export type PublicItineraryExperience = {
  id: string
  title: string
  imageUrl: string | null
  dateTime: string | null
  description: string | null
  mapsQuery: string
  bookingUrl: string | null
}

export type PublicVipSummaries = {
  weather: string | null
  packing: string | null
  budget: string | null
  flight: string | null
}

export type PreTripService = {
  title: string
  datetime: string
  location_url: string
  phone: string
  note: string
  /** حالة سداد المورد — للموظف فقط */
  supplierPaid?: boolean
}

export function emptyPreTripService(): PreTripService {
  return { title: '', datetime: '', location_url: '', phone: '', note: '', supplierPaid: false }
}

export function parsePreTripServices(raw: unknown): PreTripService[] {
  if (raw == null) return []
  let data: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      data = JSON.parse(trimmed) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(data)) return []
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const title = String(row.title ?? '').trim()
      if (!title) return null
      return {
        title,
        datetime: String(row.datetime ?? row.appointment_time ?? '').trim(),
        location_url: String(row.location_url ?? row.map_url ?? '').trim(),
        phone: String(row.phone ?? row.contact_number ?? '').trim(),
        note: String(row.note ?? '').trim(),
        supplierPaid:
          row.supplier_paid === true ||
          row.supplierPaid === true ||
          String(row.supplier_paid ?? '').toLowerCase() === 'paid',
      }
    })
    .filter((item): item is PreTripService => item != null)
}

export function serializePreTripServicesForSave(
  services: PreTripService[] | undefined,
): PreTripService[] {
  return (services ?? [])
    .map((s) => ({
      title: s.title.trim(),
      datetime: s.datetime.trim(),
      location_url: s.location_url.trim(),
      phone: s.phone.trim(),
      note: s.note.trim(),
      supplier_paid: s.supplierPaid === true,
    }))
    .filter((s) => s.title.length > 0)
}

export function formatPreTripServiceDatetime(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('ar-SA', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return s
}

const MEDICAL_PRETRIP_RE =
  /طب|طبي|استشارة|كوري|عيادة|clinic|medical|consult|doctor|دكتور|korean/i

export function itineraryHasMedicalPreTrip(services: PreTripService[]): boolean {
  return services.some((service) =>
    MEDICAL_PRETRIP_RE.test(`${service.title} ${service.note}`.trim()),
  )
}

export type PublicItinerary = {
  id: string | number
  magicLinkId: string | null
  title: string
  destination: string
  customerName: string
  startDate: string | null
  endDate: string | null
  coverImage: string | null
  flightDetails: Record<string, unknown> | null
  weather: PublicWeatherForecast | null
  budget: PublicBudgetSummary
  discover: PublicDestinationDiscover
  highlights: string[]
  vipSummaries: PublicVipSummaries
  /** ملخصات نصية من الأعمدة العليا — للتبويب الرئيسية */
  weather_summary: string | null
  packing_summary: string | null
  budget_summary: string | null
  flight_summary: string | null
  days: PublicItineraryDay[]
  hotels: PublicItineraryHotel[]
  experiences: PublicItineraryExperience[]
  hasPin: boolean
  /** عند true يتجاوز العميل قفل 24 ساعة ويرى المسار كاملاً */
  bypass_24h_lock: boolean
  /** خدمات الكونسيرج ما قبل السفر (صالون، تجميل، …) */
  preTripServices: PreTripService[]
  /** @deprecated Fashion module removed — always false at runtime */
  includeWardrobe: boolean
  /** @deprecated Fashion module removed — always false at runtime */
  showFashionServices: boolean
  isQuotation: boolean
  isMedical: boolean
  documents: ItineraryDocument[]
  ticketDetails: ActivityTicket[]
  quotationDetails: QuotationDetails
  /** التكلفة التقديرية (طيران وفنادق) — عرض سعر */
  totalEstimatedCost: number
  /** رسوم خدمة Wanderloom — عرض سعر */
  expectedProfit: number
  /** معرّف العميل في CRM — لجلب محفظة العهدة */
  clientId: string | number | null
  /** كود الإحالة العام — آمن للمشاركة (ليس رمز الملف الشخصي) */
  referralCode: string | null
  /** شريحة VIP التلقائية من إجمالي المصروف */
  clientVipTier: VipSpendingTier | null
}

function parseFinancialNumber(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseHotelRecord(
  raw: unknown,
  destination: string,
  idSuffix: string,
): PublicItineraryHotel | null {
  if (raw == null) return null
  const row =
    raw && typeof raw === 'object' && 'hotel' in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).hotel
      : raw
  const h = stripSensitiveObject(row)
  if (!h) return null

  const name = pickStr(h, ['name', 'title'])
  if (!name) return null

  const city = pickStr(h, ['city']) || null
  const country = pickStr(h, ['country']) || null
  const categoryRaw = pickStr(h, ['category', 'tier', 'hotel_category']) || null
  const notes =
    pickStr(h, [
      'notes',
      'booking_notes',
      'confirmation_notes',
      'booking_rules',
      'rules',
      'description',
    ]) || null
  const checkIn =
    pickStr(h, ['check_in', 'check_in_date', 'checkin', 'arrival_date']) || null
  const checkOut =
    pickStr(h, ['check_out', 'check_out_date', 'checkout', 'departure_date']) || null
  const address =
    pickStr(h, ['address', 'hotel_address', 'street_address', 'location']) || null

  return {
    id: `hotel-${idSuffix}-${name.replace(/\s+/g, '-').slice(0, 40)}`,
    name,
    imageUrl: pickImageUrl(h),
    checkIn,
    checkOut,
    bookingReference:
      pickStr(h, [
        'booking_reference',
        'confirmation',
        'reference',
        'booking_ref',
        'confirmation_number',
      ]) || null,
    address,
    mapsQuery: address || buildMapsQuery([name, city, destination]),
    bookingUrl: pickBookingUrl(h),
    city,
    country,
    category: categoryRaw,
    categoryLabel: categoryRaw ? formatPublicHotelCategoryLabel(categoryRaw) : null,
    notes,
  }
}

/** تسمية عربية لتصنيف الفندق في وثيقة الحجز */
export function formatPublicHotelCategoryLabel(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  const map: Record<string, string> = {
    ultra_luxury: 'فاخر جداً (Ultra Luxury)',
    boutique_design: 'بوتيك / تصميم',
    apartments_luxe: 'شقق فاخرة',
    smart_choice: 'اختيار ذكي',
    boutique: 'بوتيك',
    four_star: '4 نجوم',
    five_star: '5 نجوم',
    ryokan: 'ريوكان',
    luxury: 'فاخر',
    standard: 'قياسي',
    economy: 'اقتصادي',
  }
  return map[key] ?? raw.trim()
}

function parseExperienceRecord(
  raw: unknown,
  destination: string,
  idSuffix: string,
): PublicItineraryExperience | null {
  if (raw == null) return null
  const e = stripSensitiveObject(raw)
  if (!e) return null

  const title = pickStr(e, ['title', 'name'])
  if (!title) return null

  const city = pickStr(e, ['city'])
  const desc = pickStr(e, ['description', 'summary', 'note'])
  const dateTime =
    pickStr(e, ['date_time', 'datetime', 'scheduled_at', 'date', 'time']) || null

  return {
    id: `exp-${idSuffix}-${title.replace(/\s+/g, '-').slice(0, 40)}`,
    title,
    imageUrl: pickImageUrl(e),
    dateTime,
    description: desc || null,
    mapsQuery: buildMapsQuery([title, city, destination]),
    bookingUrl: pickBookingUrl(e),
  }
}

export function parsePublicHotels(
  row: Record<string, unknown>,
  destination: string,
): PublicItineraryHotel[] {
  const map = new Map<string, PublicItineraryHotel>()

  const add = (hotel: PublicItineraryHotel | null) => {
    if (!hotel) return
    const key = (hotel.name ?? '').trim().toLowerCase()
    if (!map.has(key)) map.set(key, hotel)
  }

  for (const item of parseJsonArray(row.hotel_details)) {
    add(parseHotelRecord(item, destination, 'listed'))
  }

  for (const [index, item] of parseJsonArray(row.days_data).entries()) {
    if (!item || typeof item !== 'object') continue
    const d = item as Record<string, unknown>
    add(parseHotelRecord(d.hotel, destination, `day-${index}`))
    for (const alt of parseJsonArray(d.alternative_hotels)) {
      if (!alt || typeof alt !== 'object') continue
      const a = alt as Record<string, unknown>
      add(parseHotelRecord(a.hotel ?? a, destination, `alt-${index}`))
    }
  }

  return [...map.values()]
}

export function parsePublicExperiences(
  row: Record<string, unknown>,
  destination: string,
): PublicItineraryExperience[] {
  const map = new Map<string, PublicItineraryExperience>()

  const add = (exp: PublicItineraryExperience | null) => {
    if (!exp) return
    const key = (exp.title ?? '').trim().toLowerCase()
    if (!map.has(key)) map.set(key, exp)
  }

  for (const item of parseJsonArray(row.experiences_details)) {
    add(parseExperienceRecord(item, destination, 'listed'))
  }

  for (const [index, item] of parseJsonArray(row.days_data).entries()) {
    if (!item || typeof item !== 'object') continue
    const d = item as Record<string, unknown>
    add(parseExperienceRecord(d.experience, destination, `day-${index}`))
  }

  return [...map.values()]
}

export function parsePublicDestinationDiscover(
  row: Record<string, unknown>,
): PublicDestinationDiscover {
  const destinationStory = pickStr(row, ['destination_story']) || null
  const taxiPhrase = pickStr(row, ['taxi_phrase']) || null
  const secretGem = pickStr(row, ['secret_gem']) || null
  return { destinationStory, taxiPhrase, secretGem }
}

export function hasPublicDestinationDiscover(discover: PublicDestinationDiscover): boolean {
  return Boolean(discover.destinationStory || discover.taxiPhrase || discover.secretGem)
}

const SENSITIVE_DAY_KEYS = new Set([
  'cost',
  'price',
  'margin',
  'profit',
  'supplier',
  'supplier_phone',
  'supplier_email',
  'internal_notes',
  'internal_note',
  'crm_notes',
])

function pickStr(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function parseJsonArray(raw: unknown): unknown[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

export type ParsedDaysDataFromRow = {
  days: Array<Record<string, unknown>>
}

/**
 * يفكّ days_data من Supabase: مصفوفة أيام أو { __vip_summaries, days }.
 */
export function parseDaysDataFromRow(raw: unknown): ParsedDaysDataFromRow {
  if (raw == null) return { days: [] }

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return { days: [] }
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return { days: [] }
    }
  }

  if (Array.isArray(parsed)) {
    return {
      days: parsed.filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      ),
    }
  }

  if (parsed && typeof parsed === 'object') {
    const envelope = parsed as Record<string, unknown>
    const nested = envelope.days ?? envelope.days_data
    const days = parseJsonArray(nested).filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
    )
    if (days.length > 0) return { days }
  }

  return { days: [] }
}

export type VipEmbeddedSummaryFields = {
  weather_summary: string | null
}

/** ملخصات VIP مضمّنة داخل days_data أو أعمدة الصف */
export function extractVipSummaryFields(row: Record<string, unknown>): VipEmbeddedSummaryFields {
  const fromColumn = coerceAdminSummaryString(row.weather_summary ?? row.weatherSummary)
  if (fromColumn) return { weather_summary: fromColumn }

  const raw = row.days_data ?? row.days
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      return { weather_summary: null }
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const envelope = parsed as Record<string, unknown>
    const embedded = envelope.__vip_summaries
    if (embedded && typeof embedded === 'object') {
      const s = embedded as Record<string, unknown>
      const w = coerceAdminSummaryString(s.weather_summary)
      if (w) return { weather_summary: w }
    }
  }

  return { weather_summary: null }
}

function stripSensitiveObject(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const src = obj as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    const key = k.toLowerCase()
    if (SENSITIVE_DAY_KEYS.has(key) || key.includes('supplier') || key.includes('margin') || key.includes('cost')) {
      continue
    }
    if (key === 'notes' && typeof v === 'string' && v.length > 0) {
      continue
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripSensitiveObject(v) ?? {}
    } else if (!Array.isArray(v)) {
      out[k] = v
    }
  }
  return out
}

function publicHotelLine(hotel: unknown): string {
  const h = stripSensitiveObject(hotel)
  if (!h) return ''
  const name = pickStr(h, ['name', 'title'])
  const city = pickStr(h, ['city'])
  const country = pickStr(h, ['country'])
  const loc = [city, country].filter(Boolean).join(' · ')
  if (name && loc) return `${name} — ${loc}`
  return name || loc
}

function publicExperienceLine(exp: unknown): string {
  const e = stripSensitiveObject(exp)
  if (!e) return ''
  const title = pickStr(e, ['title', 'name'])
  const city = pickStr(e, ['city'])
  const desc = pickStr(e, ['description', 'summary'])
  const parts = [title, city, desc].filter(Boolean)
  return parts.join(' · ')
}

function formatDayDate(startDate: string | null, dayIndex: number): string {
  if (!startDate) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDate.trim())
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dayIndex)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })
}

function buildMapsQuery(parts: Array<string | null | undefined>): string {
  return [...new Set(parts.map((p) => (p ?? '').trim()).filter(Boolean))].join(', ')
}

export type PublicDayMediaContext = {
  hotelDetails?: unknown
  experiencesDetails?: unknown
  coverImage?: string | null
}

function pickImageUrl(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  const url = pickStr(obj, [
    'image_url',
    'thumbnail_url',
    'cover_image',
    'photo_url',
    'image',
    'hero_image',
    'picture',
    'picture_url',
    'media_url',
  ])
  if (url) return url
  const icon = pickStr(obj, ['icon'])
  if (/^https?:\/\//i.test(icon)) return icon
  return null
}

function buildNameImageLookup(items: unknown): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of parseJsonArray(items)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = pickStr(o, ['name', 'title', 'place_name']).trim().toLowerCase()
    const url = pickImageUrl(o)
    if (name && url) map.set(name, url)
  }
  return map
}

function resolveActivityImageUrl(
  source: Record<string, unknown> | null,
  title: string,
  lookups: { hotels: Map<string, string>; experiences: Map<string, string> },
  coverImage: string | null,
): string | null {
  const direct = pickImageUrl(source)
  if (direct) return direct

  const key = (title ?? '').trim().toLowerCase()
  if (key) {
    const exactHotel = lookups.hotels.get(key)
    if (exactHotel) return exactHotel
    const exactExp = lookups.experiences.get(key)
    if (exactExp) return exactExp

    for (const [name, url] of lookups.hotels) {
      if (key.includes(name) || name.includes(key)) return url
    }
    for (const [name, url] of lookups.experiences) {
      if (key.includes(name) || name.includes(key)) return url
    }
  }

  return coverImage?.trim() || null
}

function pickGoogleMapsUrl(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  const url = pickStr(obj, ['google_maps_url', 'maps_url', 'map_url', 'google_maps_link'])
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim()
  if (!url) return null
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    const parsed = new URL(href)
    if (!parsed.hostname) return null
    return href
  } catch {
    return null
  }
}

/** رابط حجز المحطة فقط — لا maps ولا detail_url */
function pickStopBookingUrl(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  return normalizeHttpUrl(pickStr(obj, ['booking_url']))
}

export function resolveStopBookingHref(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  return normalizeHttpUrl(trimmed) ?? trimmed
}

function pickBookingUrl(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  const url = pickStr(obj, ['booking_url', 'detail_url', 'reservation_url', 'ticket_url'])
  return normalizeHttpUrl(url)
}

/**
 * ملخصات VIP للعميل: نص كتبه الأدمن فقط.
 * كائنات JSON القديمة (مثل budget_summary: { spent, total }) تُعامل كفارغة.
 */
export function coerceAdminSummaryString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'object') return null
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    const s = String(raw).trim()
    return s || null
  }
  if (typeof raw !== 'string') return null

  const s = raw.trim()
  if (!s || s === 'null' || s === 'undefined') return null

  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(s)
      if (typeof parsed === 'string') {
        const inner = parsed.trim()
        return inner || null
      }
      return null
    } catch {
      return s
    }
  }

  return s
}

/** يحوّل ملخصاً من DB (نص / JSON / كائن) إلى نص آمن للعرض */
export function coerceSummaryDisplayText(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return coerceSummaryDisplayText(JSON.parse(s))
      } catch {
        return s
      }
    }
    return s
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw)
  }
  if (Array.isArray(raw)) {
    const lines = raw
      .map((item) => coerceSummaryDisplayText(item))
      .filter((line): line is string => Boolean(line?.trim()))
    return lines.length > 0 ? lines.join('\n') : null
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const preferred = pickStr(o, ['text', 'summary', 'description', 'body', 'value', 'content', 'note'])
    if (preferred) return preferred
    const lines = Object.entries(o)
      .map(([key, value]) => {
        if (value == null) return ''
        if (typeof value === 'object') {
          const nested = coerceSummaryDisplayText(value)
          return nested ? `${key}: ${nested}` : ''
        }
        const text = String(value).trim()
        return text ? `${key}: ${text}` : ''
      })
      .filter(Boolean)
    return lines.length > 0 ? lines.join('\n') : null
  }
  return null
}

/** يستخرج ملخصات VIP من صف المسار (نص الأدمن فقط) */
export function parseVipSummaries(row: Record<string, unknown>): PublicVipSummaries {
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const text = coerceAdminSummaryString(row[key])
      if (text) return text
    }
    return null
  }
  return {
    weather: pick(['weather_summary', 'weatherSummary']),
    packing: pick(['packing_summary', 'packingSummary']),
    budget: pick(['budget_summary', 'budgetSummary']),
    flight: pick(['flight_summary', 'flightSummary']),
  }
}

function isGenericDayTitle(title: string | null | undefined): boolean {
  const t = (title ?? '').trim()
  if (!t) return true
  return /^(اليوم|day)\s*\d+/i.test(t) || /^اليوم\s+الأول$/i.test(t)
}

function resolveDayCityLabel(d: Record<string, unknown>, destination: string): string {
  const direct = pickStr(d, ['city', 'location', 'place'])
  if (direct) return direct

  const hotel = stripSensitiveObject(d.hotel)
  const hotelCity = hotel ? pickStr(hotel, ['city']) : ''
  if (hotelCity) return hotelCity

  const exp = stripSensitiveObject(d.experience)
  const expCity = exp ? pickStr(exp, ['city']) : ''
  if (expCity) return expCity

  const title = pickStr(d, ['title'])
  const dash = title.split(/[-–—|]/).map((p) => p.trim()).filter(Boolean)
  if (dash.length >= 2) return dash[dash.length - 1]!
  if (title && !isGenericDayTitle(title)) return title

  const stops = parseJsonArray(d.itinerary_stops ?? d.stops)
  for (const stop of stops) {
    if (!stop || typeof stop !== 'object') continue
    const city = pickStr(stop as Record<string, unknown>, ['city', 'location'])
    if (city) return city
  }

  return (destination ?? '').trim() || ''
}

function buildDayTabLabel(index: number, cityLabel: string): string {
  const dayNum = index + 1
  return cityLabel ? `اليوم ${dayNum} - ${cityLabel}` : `اليوم ${dayNum}`
}

function pickStopStory(s: Record<string, unknown>): string | null {
  const story = pickStr(s, ['story'])
  if (story) return story
  const description = pickStr(s, ['description'])
  const note = pickStr(s, ['note'])
  if (description && description !== note) return description
  return null
}

function pickStopShortNote(s: Record<string, unknown>): string {
  const note = pickStr(s, ['note'])
  const story = pickStr(s, ['story'])
  if (note && note !== story) return note
  if (!story && note) return note
  return ''
}

function pickStopCategoryCode(s: Record<string, unknown>): string {
  return pickStr(s, ['category']) || 'o'
}

function pickStopLocationLabel(
  s: Record<string, unknown>,
  dayCity: string,
): string | null {
  const city = pickStr(s, ['city', 'location'])
  const country = pickStr(s, ['country'])
  const parts = [city, country].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  return dayCity.trim() || null
}

function isTransportStopCategory(cat: string): boolean {
  const c = cat.trim().toLowerCase()
  return c === 'transport' || c === 'transit'
}

function extractTransitFromStop(s: Record<string, unknown>): {
  mode: VipTransitIconKind
  duration: string
} | null {
  const duration = pickStr(s, [
    'transit_duration',
    'transitDuration',
    'transit_time',
  ]).trim()
  const modeRaw = pickStr(s, ['transit_mode', 'transitMode']).toLowerCase()
  if (!duration && !modeRaw) return null
  let mode: VipTransitIconKind = 'car'
  if (modeRaw === 'metro' || modeRaw === 'walk' || modeRaw === 'walking' || modeRaw === 'car') {
    mode = modeRaw === 'walking' ? 'walk' : (modeRaw as VipTransitIconKind)
  } else if (modeRaw) {
    mode = resolveVipTransitIconKind(modeRaw)
  }
  return { mode, duration }
}

function sortDayStops(stopsRaw: unknown[]): Record<string, unknown>[] {
  return stopsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
}

export type VipTransitIconKind = 'metro' | 'car' | 'walk' | 'default'

/** يحدد أيقونة النقل من كلمات الأدمن في transport_type / transit_to_next */
export function resolveVipTransitIconKind(text: string): VipTransitIconKind {
  const raw = text.trim()
  if (!raw) return 'default'
  if (/مترو|metro|subway|train|قطار|tram/i.test(raw)) return 'metro'
  if (/سيارة|أوبر|اوبر|تاكسي|car|taxi|uber|drive|cab/i.test(raw)) return 'car'
  if (/مشي|walk|walking|foot|على\s*الأقدام/i.test(raw)) return 'walk'
  return 'default'
}

/** نص النقل كما كتبه الأدمن فقط — بدون دقائق وهمية */
function pickTransportLabel(s: Record<string, unknown>): string | null {
  const label = pickStr(s, [
    'transit_to_next',
    'transitToNext',
    'transport_type',
    'taxi',
    'transit_mode',
    'transport',
  ])
  return label || null
}

/** مسار بنك الأماكن — stops فقط بدون فنادق/تجارب legacy */
function parseActivitiesFromPlaceStops(
  stopsRaw: unknown[],
  destination: string,
  dayCity: string,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryActivity[] {
  const activities: PublicItineraryActivity[] = []
  let seq = 0
  const sorted = sortDayStops(stopsRaw)
  const imageLookups = {
    hotels: buildNameImageLookup(mediaContext?.hotelDetails),
    experiences: buildNameImageLookup(mediaContext?.experiencesDetails),
  }
  const coverFallback = mediaContext?.coverImage?.trim() || null
  let placeOrdinal = 0

  for (const stop of sorted) {
    const s = stop
    const categoryCode = pickStopCategoryCode(s)
    if (isTransportStopCategory(categoryCode)) continue

    const name = pickStr(s, ['place_name', 'name', 'title'])
    const story = pickStopStory(s)
    const note = pickStopShortNote(s)
    if (!name && !note && !story) continue

    const transit = placeOrdinal > 0 ? extractTransitFromStop(s) : null
    const placeName = name || 'محطة في البرنامج'
    const stopCity = pickStr(s, ['city', 'location']) || dayCity
    const categoryLabel = placeBankCategoryLabel(categoryCode)
    const coords = pickLatLngFromRecord(s)
    const timeLabel = resolveActivityTimeLabel(s)

    activities.push({
      id: `day-act-${seq}`,
      title: placeName,
      place_name: placeName,
      description: note,
      story,
      timeLabel,
      imageUrl:
        pickImageUrl(s) ??
        resolveActivityImageUrl(s, placeName, imageLookups, coverFallback),
      mapsQuery: buildMapsQuery([placeName, story, note, stopCity, destination]),
      bookingUrl: pickStopBookingUrl(s),
      booking_url: pickStr(s, ['booking_url']) || null,
      googleMapsUrl: pickGoogleMapsUrl(s),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      transitFromPreviousMinutes: null,
      transportLabel: pickTransportLabel(s),
      category: categoryCode,
      categoryLabel,
      locationLabel: pickStopLocationLabel(s, dayCity),
      transitMode: transit?.mode ?? null,
      transitDuration: transit?.duration ?? null,
    })
    seq += 1
    placeOrdinal += 1
  }

  return activities
}

function parseActivitiesFromDayRecord(
  d: Record<string, unknown>,
  destination: string,
  dayTitle: string,
  dayCity: string,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryActivity[] {
  const stopsRaw = parseJsonArray(d.itinerary_stops ?? d.stops)
  const hasStops = stopsRaw.length > 0

  if (hasStops) {
    const fromStops = parseActivitiesFromPlaceStops(stopsRaw, destination, dayCity, mediaContext)
    if (fromStops.length > 0) return fromStops
  }

  const activities: PublicItineraryActivity[] = []
  let seq = 0

  const imageLookups = {
    hotels: buildNameImageLookup(mediaContext?.hotelDetails),
    experiences: buildNameImageLookup(mediaContext?.experiencesDetails),
  }
  const coverFallback = mediaContext?.coverImage?.trim() || null

  type LegacyActivityInput = {
    title: string
    description: string
    mapsQuery: string
    bookingUrl?: string | null
    imageUrl?: string | null
    story?: string | null
    transportLabel?: string | null
    googleMapsUrl?: string | null
    place_name?: string | null
    booking_url?: string | null
    lat?: number | null
    lng?: number | null
    category?: string | null
    categoryLabel?: string | null
    locationLabel?: string | null
    transitMode?: VipTransitIconKind | null
    transitDuration?: string | null
  }

  const push = (activity: LegacyActivityInput, timeSource?: Record<string, unknown> | null) => {
    const timeLabel = resolveActivityTimeLabel(timeSource ?? null)
    const imageUrl =
      activity.imageUrl ??
      resolveActivityImageUrl(timeSource ?? null, activity.title, imageLookups, coverFallback)
    const coords = pickLatLngFromRecord(timeSource ?? null)
    const source = timeSource ?? null

    const src = source as Record<string, unknown> | null
    const rawBooking =
      activity.booking_url ?? (src ? pickStr(src, ['booking_url']) || null : null)

    const placeName =
      activity.place_name ??
      (src ? pickStr(src, ['place_name', 'name', 'title']) || null : null) ??
      (activity.title?.trim() || null)

    activities.push({
      id: `day-act-${seq}`,
      title: activity.title,
      description: activity.description,
      mapsQuery: activity.mapsQuery,
      place_name: placeName,
      timeLabel,
      story: activity.story ?? null,
      transportLabel: activity.transportLabel ?? null,
      category: activity.category ?? null,
      categoryLabel: activity.categoryLabel ?? null,
      locationLabel: activity.locationLabel ?? null,
      transitMode: activity.transitMode ?? null,
      transitDuration: activity.transitDuration ?? null,
      booking_url: rawBooking,
      bookingUrl: activity.bookingUrl ?? (src ? pickStopBookingUrl(src) : null),
      googleMapsUrl: activity.googleMapsUrl ?? pickGoogleMapsUrl(src) ?? null,
      transitFromPreviousMinutes: null,
      imageUrl,
      lat: coords?.lat ?? activity.lat ?? null,
      lng: coords?.lng ?? activity.lng ?? null,
    })
    seq += 1
  }

  const notes = pickStr(d, ['notes', 'description', 'summary', 'client_notes'])
  if (notes && !hasStops) {
    push(
      {
        title: dayTitle || 'برنامج اليوم',
        description: notes,
        imageUrl: pickImageUrl(d),
        mapsQuery: buildMapsQuery([
          pickStr(d, ['location', 'place', 'maps_query', 'map_query']),
          dayCity,
          dayTitle,
          destination,
        ]),
        bookingUrl: pickBookingUrl(d),
      },
      d,
    )
  }

  const hotel = stripSensitiveObject(d.hotel)
  if (hotel) {
    const name = pickStr(hotel, ['name', 'title'])
    const city = pickStr(hotel, ['city'])
    const country = pickStr(hotel, ['country'])
    const loc = [city, country].filter(Boolean).join(' · ')
    push(
      {
        title: name || 'الإقامة الفاخرة',
        description: loc || pickStr(hotel, ['notes']) || 'تفاصيل الفندق',
        imageUrl: pickImageUrl(hotel),
        mapsQuery: buildMapsQuery([name, loc, dayCity, destination]),
        bookingUrl: pickBookingUrl(hotel),
      },
      hotel,
    )
  }

  const altHotels = parseJsonArray(d.alternative_hotels)
  for (const alt of altHotels) {
    if (!alt || typeof alt !== 'object') continue
    const row = alt as Record<string, unknown>
    const h = stripSensitiveObject(row.hotel ?? row)
    if (!h) continue
    const name = pickStr(h, ['name', 'title'])
    const tier = pickStr(row, ['tier'])
    push(
      {
        title: name ? `${name}${tier ? ` (${tier})` : ''}` : 'خيار إقامة بديل',
        description: [pickStr(h, ['city']), pickStr(h, ['country'])].filter(Boolean).join(' · '),
        imageUrl: pickImageUrl(h),
        mapsQuery: buildMapsQuery([name, pickStr(h, ['city']), dayCity, destination]),
        bookingUrl: pickBookingUrl(h),
      },
      h,
    )
  }

  const exp = stripSensitiveObject(d.experience)
  if (exp) {
    const title = pickStr(exp, ['title', 'name'])
    const desc = pickStr(exp, ['description', 'summary'])
    const city = pickStr(exp, ['city'])
    push(
      {
        title: title || 'تجربة حصرية',
        description: [city, desc].filter(Boolean).join(' · ') || 'تجربة مصممة لك',
        imageUrl: pickImageUrl(exp),
        mapsQuery: buildMapsQuery([title, city, dayCity, destination]),
        bookingUrl: pickBookingUrl(exp),
      },
      exp,
    )
  }

  if (activities.length === 0) {
    const hotelLine = publicHotelLine(d.hotel)
    const expLine = publicExperienceLine(d.experience)
    const bodyParts = [notes, hotelLine, expLine].filter(Boolean)
    push(
      {
        title: dayTitle,
        description: bodyParts.join('\n\n') || 'التفاصيل قريباً…',
        imageUrl: pickImageUrl(d),
        mapsQuery: buildMapsQuery([
      pickStr(d, ['location', 'place', 'maps_query', 'map_query']),
      hotelLine,
      expLine,
          dayTitle,
          destination,
        ]),
        bookingUrl: pickBookingUrl(d),
      },
      d,
    )
  }

  return activities
}

function parsePublicDayFromRecord(
  d: Record<string, unknown>,
  index: number,
  destination: string,
  startDate: string | null,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryDay {
  const title = pickStr(d, ['title']) || `اليوم ${index + 1}`
  const cityLabel = resolveDayCityLabel(d, destination)
  const hotelNameRaw =
    pickStr(d, ['hotelName', 'hotel_name']) ||
    (d.hotel && typeof d.hotel === 'object'
      ? pickStr(d.hotel as Record<string, unknown>, ['name', 'title'])
      : '')
  const hotelName = hotelNameRaw.trim() || undefined
  const activities = parseActivitiesFromDayRecord(d, destination, title, cityLabel, mediaContext)
  const mapsQuery =
    buildMapsQuery([
      cityLabel,
      ...activities.map((a) => a.mapsQuery),
      title,
      destination,
      hotelName,
    ]) || destination

    return {
      index,
      title,
    cityLabel,
    tabLabel: buildDayTabLabel(index, cityLabel),
      dateLabel: formatDayDate(startDate, index),
    mapsQuery,
    ...(hotelName ? { hotelName } : {}),
    activities,
  }
}

export function sanitizePublicDays(
  rawDays: unknown,
  destination: string,
  startDate: string | null,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryDay[] {
  const { days: arr } = parseDaysDataFromRow(rawDays)
  return arr.map((item, index) => {
    const d = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return parsePublicDayFromRecord(d, index, destination, startDate, mediaContext)
  })
}

function parseHighlights(raw: unknown): string[] {
  const arr = parseJsonArray(raw)
  const out: string[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push(t)
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const t = pickStr(o, ['title', 'name', 'label', 'text'])
      if (t) out.push(t)
    }
  }
  return out
}

function parseFlightDetails(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  let fd: Record<string, unknown> | null = null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    fd = stripSensitiveObject(raw)
  } else if (typeof raw === 'string') {
    try {
      fd = stripSensitiveObject(JSON.parse(raw))
    } catch {
      return null
    }
  }
  if (!fd) return null
  return fd
}

function parseLegacyDatesField(dates: unknown): { start: string | null; end: string | null } {
  if (dates == null) return { start: null, end: null }
  const raw = String(dates).trim()
  if (!raw) return { start: null, end: null }
  const parts = raw.split('→').map((x) => x.trim())
  if (parts.length >= 2) {
    return { start: parts[0].slice(0, 10) || null, end: parts[1].slice(0, 10) || null }
  }
  return { start: raw.slice(0, 10) || null, end: null }
}

function extractPasscodeFromRow(row: Record<string, unknown>): string | null {
  const passcode = pickStr(row, ['passcode'])
  return passcode ? passcode.toUpperCase() : null
}

function parseBudgetOptionsRaw(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return null
}

function pickBudgetNumber(bo: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = parseBudgetNumericValue(bo[k])
    if (n != null) return n
  }
  return null
}

export function parsePublicWeatherForecast(
  row: Record<string, unknown>,
  destination: string,
): PublicWeatherForecast | null {
  const dest = destination.trim()
  if (!dest) return null

  const tempRaw = row.weather_temp
  if (tempRaw == null || !Number.isFinite(Number(tempRaw))) {
    return {
      destination: dest,
      tempMin: 18,
      tempMax: 24,
      condition: 'مشمس جزئياً',
    }
  }

  const center = Math.round(Number(tempRaw))
  const tempMin = center - 3
  const tempMax = center + 3
  let condition = 'مشمس جزئياً'
  if (center >= 34) condition = 'حار ومشمس'
  else if (center >= 28) condition = 'دافئ ومشمس'
  else if (center >= 18) condition = 'مشمس جزئياً'
  else if (center >= 10) condition = 'معتدل وغائم جزئياً'
  else condition = 'بارد وصحو'

  return { destination: dest, tempMin, tempMax, condition }
}

function parseBudgetNumericValue(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function pickBudgetAmount(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = parseBudgetNumericValue(row[k])
    if (n != null) return n
  }
  return null
}

/** تنسيق مبلغ للعرض العام — en-US + ر.س. */
export function formatPublicBudgetSar(amount: number): string {
  return `${amount.toLocaleString('en-US')} ر.س.`
}

export function parsePublicBudgetSummary(row: Record<string, unknown>): PublicBudgetSummary {
  let total =
    pickBudgetAmount(row, ['total_budget']) ??
    pickBudgetAmount(row, ['total_price']) ??
    pickBudgetAmount(row, ['budget']) ??
    0

  let spent =
    pickBudgetAmount(row, ['amount_paid']) ??
    pickBudgetAmount(row, ['spent_amount']) ??
    pickBudgetAmount(row, ['paid']) ??
    0

  const bo = parseBudgetOptionsRaw(row.budget_options)
  let currency = 'SAR'

  if (bo) {
    const cur = pickStr(bo, ['currency'])
    if (cur) currency = cur.toUpperCase()
    if (total <= 0) {
      const boTotal = pickBudgetAmount(bo, ['total', 'total_budget', 'budget'])
      if (boTotal != null) total = boTotal
    }
    if (spent <= 0) {
      const boPaid = pickBudgetAmount(bo, ['paid', 'amount_paid', 'spent', 'spent_amount'])
      if (boPaid != null) spent = boPaid
    }
  }

  if (total < 0) total = 0
  if (spent < 0) spent = 0

  const remaining = total - spent
  return { total, spent, remaining, currency }
}

/** يجمع مدفوعات جدول payments إن وُجد — يعيد null إذا الجدول غير متاح */
export async function sumSuccessfulPaymentsForItinerary(
  client: SupabaseClient,
  itineraryId: string | number,
): Promise<number | null> {
  try {
    const { data, error } = await client
      .from('payments')
      .select('amount')
      .eq('itinerary_id', itineraryId)
      .eq('status', 'success')

    if (error) return null
    if (!data?.length) return 0

    return data.reduce((sum, row) => {
      const amt = parseBudgetNumericValue((row as { amount?: unknown }).amount)
      return sum + (amt ?? 0)
    }, 0)
  } catch {
    return null
  }
}

export function mergePublicBudgetWithPayments(
  budget: PublicBudgetSummary,
  paymentsTotal: number | null,
): PublicBudgetSummary {
  if (paymentsTotal == null) return budget
  const spent = Math.max(budget.spent, paymentsTotal)
  return {
    ...budget,
    spent,
    remaining: Math.max(0, budget.total - spent),
  }
}

/** هل وسيلة النقل بين محطتين هي سيارة/تاكسي */
export function isCarTransitActivity(activity: PublicItineraryActivity): boolean {
  if (activity.transitMode === 'car') return true
  const label = activity.transportLabel?.trim() ?? ''
  if (label === 'سيارة') return true
  return resolveVipTransitIconKind(label) === 'car'
}

function buildDayMediaContext(row: Record<string, unknown>): PublicDayMediaContext {
  return {
    hotelDetails: row.hotel_details,
    experiencesDetails: row.experiences_details,
    coverImage:
      pickStr(row, ['cover_image', 'image_url', 'hero_image', 'city_image']) || null,
  }
}

function isParsedPublicDay(item: unknown): item is PublicItineraryDay {
  return Boolean(
    item &&
      typeof item === 'object' &&
      'activities' in item &&
      Array.isArray((item as PublicItineraryDay).activities),
  )
}

/** يوم واحد آمن — يعيد parse من stops/raw أو يكمّل activities الناقصة */
export function normalizePublicDayEntry(
  item: unknown,
  index: number,
  destination: string,
  startDate: string | null,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryDay {
  if (isParsedPublicDay(item)) {
    const d = item as PublicItineraryDay
    const hotelName = d.hotelName?.trim() || undefined
    return {
      index: typeof d.index === 'number' ? d.index : index,
      title: d.title?.trim() || `اليوم ${index + 1}`,
      cityLabel: d.cityLabel ?? '',
      tabLabel: d.tabLabel?.trim() || buildDayTabLabel(index, d.cityLabel ?? ''),
      dateLabel: d.dateLabel ?? formatDayDate(startDate, index),
      mapsQuery: d.mapsQuery?.trim() || destination,
      ...(hotelName ? { hotelName } : {}),
      activities: Array.isArray(d.activities) ? d.activities : [],
    }
  }
  const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
  return parsePublicDayFromRecord(record, index, destination, startDate, mediaContext)
}

/** يضمن مصفوفات أيام/أنشطة/ملحقات حتى بعد الكاش أو JSON ناقص */
export function normalizePublicItinerary(trip: PublicItinerary): PublicItinerary {
  const destination = trip.destination?.trim() || 'وجهتك'
  const startDate = trip.startDate ?? null
  return {
    ...trip,
    highlights: Array.isArray(trip.highlights) ? trip.highlights : [],
    vipSummaries: trip.vipSummaries
      ? {
          weather: coerceAdminSummaryString(trip.vipSummaries.weather),
          packing: coerceAdminSummaryString(trip.vipSummaries.packing),
          budget: coerceAdminSummaryString(trip.vipSummaries.budget),
          flight: coerceAdminSummaryString(trip.vipSummaries.flight),
        }
      : {
          weather: null,
          packing: null,
          budget: null,
          flight: null,
        },
    weather_summary:
      coerceAdminSummaryString(trip.weather_summary) ??
      coerceAdminSummaryString(trip.vipSummaries?.weather),
    packing_summary:
      coerceAdminSummaryString(trip.packing_summary) ??
      coerceAdminSummaryString(trip.vipSummaries?.packing),
    budget_summary:
      coerceAdminSummaryString(trip.budget_summary) ??
      coerceAdminSummaryString(trip.vipSummaries?.budget),
    flight_summary:
      coerceAdminSummaryString(trip.flight_summary) ??
      coerceAdminSummaryString(trip.vipSummaries?.flight),
    hotels: Array.isArray(trip.hotels) ? trip.hotels : [],
    experiences: Array.isArray(trip.experiences) ? trip.experiences : [],
    preTripServices: Array.isArray(trip.preTripServices) ? trip.preTripServices : [],
    documents: Array.isArray(trip.documents) ? trip.documents : [],
    ticketDetails: Array.isArray(trip.ticketDetails) ? trip.ticketDetails : [],
    totalEstimatedCost: parseFinancialNumber(trip.totalEstimatedCost),
    expectedProfit: parseFinancialNumber(trip.expectedProfit),
    clientId: trip.clientId ?? null,
    referralCode: trip.referralCode?.trim() || null,
    clientVipTier: trip.clientVipTier ?? null,
    bypass_24h_lock: parseBypass24hLock(trip.bypass_24h_lock),
    title: trip.title?.trim() || 'رحلتك الاستثنائية',
    customerName: trip.customerName?.trim() || 'عميلنا المميز',
    budget: {
      total: Math.max(0, trip.budget?.total ?? 0),
      spent: Math.max(0, trip.budget?.spent ?? 0),
      remaining: Math.max(
        0,
        trip.budget?.remaining ??
          Math.max(0, (trip.budget?.total ?? 0) - (trip.budget?.spent ?? 0)),
      ),
      currency: trip.budget?.currency?.trim() || 'SAR',
    },
    days: (trip.days ?? []).map((day, index) => {
      const hotelName = day?.hotelName?.trim() || undefined
      return {
        index: typeof day?.index === 'number' ? day.index : index,
        title: day?.title?.trim() || `اليوم ${index + 1}`,
        cityLabel: day?.cityLabel ?? '',
        tabLabel: day?.tabLabel?.trim() || buildDayTabLabel(index, day?.cityLabel ?? ''),
        dateLabel: day?.dateLabel ?? formatDayDate(startDate, index),
        mapsQuery: day?.mapsQuery?.trim() || destination,
        ...(hotelName ? { hotelName } : {}),
        activities: Array.isArray(day?.activities) ? day.activities : [],
      }
    }),
  }
}

export function toPublicItinerary(row: Record<string, unknown>): PublicItinerary {
  const destination =
    pickStr(row, ['destination']) || pickStr(row, ['title']) || 'وجهتك'
  const legacyDates = parseLegacyDatesField(row.dates)
  const startDate =
    row.start_date != null ? String(row.start_date).slice(0, 10) : legacyDates.start
  const endDate =
    row.end_date != null ? String(row.end_date).slice(0, 10) : legacyDates.end
  const rawDays = row.days_data ?? row.days
  const mediaContext = buildDayMediaContext(row)
  const pin = extractPasscodeFromRow(row)

  const { days: dayRecords } = parseDaysDataFromRow(rawDays)
  const days =
    dayRecords.length > 0
      ? dayRecords.map((item, index) =>
          normalizePublicDayEntry(item, index, destination, startDate, mediaContext),
        )
      : sanitizePublicDays(rawDays, destination, startDate, mediaContext)

  return normalizePublicItinerary({
    id: row.id as string | number,
    magicLinkId: row.magic_link_id != null ? String(row.magic_link_id) : null,
    title: pickStr(row, ['title']) || 'رحلتك الاستثنائية',
    destination,
    customerName: pickStr(row, ['customer_name']) || 'عميلنا المميز',
    startDate,
    endDate,
    coverImage:
      pickStr(row, ['cover_image', 'image_url', 'hero_image', 'city_image']) || null,
    flightDetails: parseFlightDetails(row.flight_details),
    weather: parsePublicWeatherForecast(row, destination),
    budget: parsePublicBudgetSummary(row),
    discover: parsePublicDestinationDiscover(row),
    highlights: parseHighlights(row.highlights),
    vipSummaries: parseVipSummaries(row),
    weather_summary: coerceAdminSummaryString(row.weather_summary ?? row.weatherSummary),
    packing_summary: coerceAdminSummaryString(row.packing_summary ?? row.packingSummary),
    budget_summary: coerceAdminSummaryString(row.budget_summary ?? row.budgetSummary),
    flight_summary: coerceAdminSummaryString(row.flight_summary ?? row.flightSummary),
    days,
    hotels: parsePublicHotels(row, destination),
    experiences: parsePublicExperiences(row, destination),
    preTripServices: parsePreTripServices(row.pre_trip_services),
    // Fashion/wardrobe module removed — always disabled regardless of DB flags
    includeWardrobe: false,
    showFashionServices: false,
    isQuotation: row.is_quotation === true,
    isMedical: row.is_medical === true,
    documents: parseItineraryDocuments(row.documents),
    ticketDetails: parseActivityTickets(row.ticket_details),
    quotationDetails: parseQuotationDetails(row.quotation_details),
    totalEstimatedCost: parseFinancialNumber(row.total_estimated_cost),
    expectedProfit: parseFinancialNumber(row.expected_profit),
    clientId: row.client_id != null ? (row.client_id as string | number) : null,
    referralCode:
      // Never trust itinerary-row referral fields — always enrich from clients table
      null,
    clientVipTier: row.client_id != null
      ? normalizeVipSpendingTier(row.client_vip_tier, row.client_total_spent)
      : null,
    hasPin: pin != null,
    bypass_24h_lock: parseBypass24hLock(row.bypass_24h_lock ?? row.bypass24hLock),
  })
}

/** بحث Google Maps باسم المكان فقط — بدون إحداثيات */
export function buildGoogleMapsPlaceSearchUrl(
  placeName: string | null | undefined,
  fallbackText?: string | null,
): string {
  const q = (placeName ?? fallbackText ?? '').trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function googleMapsSearchUrl(query: string | null | undefined): string {
  return buildGoogleMapsPlaceSearchUrl(query)
}

function formatIsoDateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso.trim()
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return iso.trim()
  return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** أشهر مختصرة — للبطاقات الضيقة (مثل بطاقة الصعود) */
export function formatShortArabicDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso.trim()
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return iso.trim()
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatTripDateRangeShort(start: string | null, end: string | null): string {
  if (!start) return 'التواريخ قريباً'
  const s = formatShortArabicDate(start)
  if (!end || end === start) return s
  return `${s} — ${formatShortArabicDate(end)}`
}

export function formatTripDateRange(start: string | null, end: string | null): string {
  if (!start) return 'التواريخ قريباً'
  const s = formatIsoDateLabel(start)
  if (!end || end === start) return s
  const e = formatIsoDateLabel(end)
  return `${s} — ${e}`
}

export type PublicItineraryLoadResult = {
  trip: PublicItinerary | null
  /** للتحقق من الرمز فقط — لا يُعرض في الواجهة */
  pinCode: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** تدرّج أعمدة الاستعلام — إذا غاب عمود في المخطط نجرّب قائمة أضيق */
const PUBLIC_SELECT_ATTEMPTS = [
  PUBLIC_ITINERARY_SELECT,
  'id, magic_link_id, title, destination, customer_name, dates, days_data, flight_details, highlights, hotel_details, experiences_details, local_lingo, weather_temp, budget_options, total_budget, spent_amount, total_price, destination_story, taxi_phrase, secret_gem, weather_summary, packing_summary, budget_summary, flight_summary, passcode, client_id',
  'id, magic_link_id, title, destination, customer_name, dates, days_data, flight_details, highlights, passcode, client_id',
  'id, magic_link_id, title, dates, passcode, client_id',
  'id, title, dates, passcode, magic_link_id, client_id',
] as const

function isNumericId(slug: string): boolean {
  return /^\d+$/.test(slug)
}

function isUuidSlug(slug: string): boolean {
  return UUID_RE.test(slug)
}

function isSchemaColumnError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  return /column|schema cache|does not exist/.test(m)
}

type Lookup = { column: 'id' | 'magic_link_id' | 'passcode'; value: string | number }

function buildLookups(slug: string): Lookup[] {
  const out: Lookup[] = []
  const seen = new Set<string>()

  const add = (column: Lookup['column'], value: string | number) => {
    const key = `${column}:${value}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ column, value })
  }

  if (isNumericId(slug)) {
    add('id', Number(slug))
  }
  if (isUuidSlug(slug)) {
    add('magic_link_id', slug)
  }
  if (slug.toUpperCase().startsWith('WL-')) {
    add('passcode', slug.toUpperCase())
  }
  add('id', slug)
  if (isUuidSlug(slug)) {
    add('magic_link_id', slug)
  }
  add('passcode', slug.toUpperCase())

  return out
}

async function queryItineraryRow(slug: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null

  const lookups = buildLookups(slug)

  for (const select of PUBLIC_SELECT_ATTEMPTS) {
    for (const { column, value } of lookups) {
      if (column === 'magic_link_id' && !isUuidSlug(String(value))) {
        continue
      }

      const { data, error } = await supabase
    .from('itineraries')
        .select(select)
        .eq(column, value)
    .maybeSingle()

      if (data && typeof data === 'object' && !('error' in (data as object))) {
        return data as Record<string, unknown>
      }

      if (error) {
        if (isSchemaColumnError(error.message)) break
        console.warn(`[fetchPublicItinerary] ${column}:`, error.message)
      }
    }
  }

  return null
}

function mapLegacyItineraryDays(
  dayRows: Array<Record<string, unknown>>,
  destination: string,
  startDate: string | null,
  mediaContext?: PublicDayMediaContext,
): PublicItineraryDay[] {
  const sorted = [...dayRows].sort(
    (a, b) => Number(a.sort_order ?? a.day_num ?? 0) - Number(b.sort_order ?? b.day_num ?? 0),
  )

  return sorted.map((d, index) => {
    const stops = Array.isArray(d.itinerary_stops)
      ? ([...d.itinerary_stops] as Array<Record<string, unknown>>)
      : []
    stops.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))

    const record: Record<string, unknown> = { ...d, itinerary_stops: stops }
    if (!pickStr(record, ['city']) && pickStr(d, ['city'])) {
      record.city = pickStr(d, ['city'])
    }
    return parsePublicDayFromRecord(record, index, destination, startDate, mediaContext)
  })
}

async function enrichItineraryRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) return row

  const enriched: Record<string, unknown> = { ...row }

  const needsBudget =
    pickBudgetAmount(row, ['total_budget']) == null &&
    pickBudgetAmount(row, ['spent_amount']) == null &&
    pickBudgetAmount(row, ['total_price']) == null
  const needsDiscover =
    !pickStr(row, ['destination_story']) &&
    !pickStr(row, ['taxi_phrase']) &&
    !pickStr(row, ['secret_gem'])
  if (needsDiscover && row.id != null) {
    const { data: discoverRow, error: discoverErr } = await supabase
      .from('itineraries')
      .select('destination_story, taxi_phrase, secret_gem')
      .eq('id', row.id)
      .maybeSingle()
    if (!discoverErr && discoverRow && typeof discoverRow === 'object') {
      const dr = discoverRow as Record<string, unknown>
      if (dr.destination_story != null) enriched.destination_story = dr.destination_story
      if (dr.taxi_phrase != null) enriched.taxi_phrase = dr.taxi_phrase
      if (dr.secret_gem != null) enriched.secret_gem = dr.secret_gem
    }
  }

  if (needsBudget && row.id != null) {
    const { data: budgetRow, error: budgetErr } = await supabase
      .from('itineraries')
      .select('total_budget, spent_amount, total_price')
      .eq('id', row.id)
      .maybeSingle()
    if (!budgetErr && budgetRow && typeof budgetRow === 'object') {
      const br = budgetRow as Record<string, unknown>
      if (br.total_budget != null) enriched.total_budget = br.total_budget
      if (br.spent_amount != null) enriched.spent_amount = br.spent_amount
      if (br.total_price != null) enriched.total_price = br.total_price
    }
  }

  if (!pickStr(row, ['customer_name']) && row.client_id != null) {
    const { data: client, error } = await supabase
      .from('clients')
      .select('name, vip_tier, total_spent, referral_code, ref_code')
      .eq('id', row.client_id)
      .maybeSingle()
    if (!error && client && typeof client === 'object') {
      const c = client as {
        name?: string | null
        vip_tier?: string | null
        total_spent?: unknown
        referral_code?: string | null
        ref_code?: string | null
      }
      const name = c.name
      if (name != null && String(name).trim()) enriched.customer_name = String(name).trim()
      enriched.client_vip_tier = c.vip_tier
      enriched.client_total_spent = c.total_spent
      const referral = (c.ref_code ?? c.referral_code ?? '').trim()
      if (referral) enriched.referral_code = referral
    }
  } else if (row.client_id != null) {
    const { data: client, error } = await supabase
      .from('clients')
      .select('vip_tier, total_spent, referral_code, ref_code')
      .eq('id', row.client_id)
      .maybeSingle()
    if (!error && client && typeof client === 'object') {
      const c = client as {
        vip_tier?: string | null
        total_spent?: unknown
        referral_code?: string | null
        ref_code?: string | null
      }
      enriched.client_vip_tier = c.vip_tier
      enriched.client_total_spent = c.total_spent
      const referral = (c.ref_code ?? c.referral_code ?? '').trim()
      if (referral) enriched.referral_code = referral
    }
  }

  const existingDays = parseJsonArray(row.days_data ?? row.days)
  if (existingDays.length === 0 && row.id != null) {
    let dayRows: unknown[] | null = null

    const withStops = await supabase
      .from('itinerary_days')
      .select(
        'id, day_num, title, city, sort_order, itinerary_stops(place_name, note, category, sort_order)',
      )
      .eq('itinerary_id', row.id)
      .order('sort_order', { ascending: true })

    if (!withStops.error && Array.isArray(withStops.data)) {
      dayRows = withStops.data
    } else {
      const plain = await supabase
        .from('itinerary_days')
        .select('id, day_num, title, city, sort_order')
        .eq('itinerary_id', row.id)
        .order('sort_order', { ascending: true })
      if (!plain.error && Array.isArray(plain.data)) dayRows = plain.data
    }

    if (Array.isArray(dayRows) && dayRows.length > 0) {
      const destination =
        pickStr(row, ['destination']) || pickStr(row, ['title']) || 'وجهتك'
      const legacyDates = parseLegacyDatesField(row.dates)
      const startDate =
        row.start_date != null ? String(row.start_date).slice(0, 10) : legacyDates.start
      enriched.days_data = mapLegacyItineraryDays(
        dayRows as Array<Record<string, unknown>>,
        destination,
        startDate,
        buildDayMediaContext(row),
      )
    }
  }

  if (
    (enriched.client_id == null || String(enriched.client_id).trim() === '') &&
    enriched.id != null
  ) {
    const { data: members } = await supabase
      .from('itinerary_client_members')
      .select('client_id')
      .eq('itinerary_id', enriched.id)
      .limit(1);

    const memberClientId = members?.[0]?.client_id;
    if (memberClientId != null) {
      enriched.client_id = memberClientId;
    }
  }

  return enriched
}

export async function fetchPublicItinerary(slug: string): Promise<PublicItineraryLoadResult> {
  const id = slug.trim()
  if (!supabase || !id) return { trip: null, pinCode: null }

  const row = await queryItineraryRow(id)
  if (!row) return { trip: null, pinCode: null }

  const enriched = await enrichItineraryRow(row)
  const pin = extractPasscodeFromRow(enriched)
  return { trip: toPublicItinerary(enriched), pinCode: pin }
}
