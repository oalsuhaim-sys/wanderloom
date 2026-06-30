import { normalizeVipSpendingTier, parseTotalProfit, parseTotalSpent, type VipSpendingTier } from '@/lib/vip-spending-tier'
import { clientDnaSupabasePatch } from '@/lib/client-dna-columns'

export type ClientTravelDna = {
  preferred_seat?: string | null
  food_allergies?: string | null
  hotel_style?: string | null
  drink_coffee?: string | null
  secret_notes?: string | null
}

export type ClientTier = 'regular' | 'vip' | 'vvip'

/** نوع جهة الاتصال في جدول clients الموحّد */
export type ClientType = 'عميل' | 'مؤثر' | 'ليدر'

export const DEFAULT_CLIENT_TYPE: ClientType = 'عميل'

export const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string; emoji: string }[] = [
  { value: 'عميل', label: 'عميل', emoji: '💼' },
  { value: 'ليدر', label: 'ليدر', emoji: '🚀' },
  { value: 'مؤثر', label: 'مؤثر', emoji: '🌟' },
]

export function normalizeClientType(raw: unknown): ClientType {
  const s = String(raw ?? '').trim()
  if (s === 'مؤثر' || s.toLowerCase() === 'influencer') return 'مؤثر'
  if (s === 'ليدر' || s.toLowerCase() === 'leader') return 'ليدر'
  if (s === 'عميل' || s.toLowerCase() === 'client') return 'عميل'
  return DEFAULT_CLIENT_TYPE
}

export function clientTypeEmoji(type: ClientType): string {
  return CLIENT_TYPE_OPTIONS.find((o) => o.value === type)?.emoji ?? '💼'
}

export const CLIENT_TIER_OPTIONS: { value: ClientTier; label: string }[] = [
  { value: 'regular', label: 'تقليدي (Regular)' },
  { value: 'vip', label: 'VIP' },
  { value: 'vvip', label: 'VVIP' },
]

export type VipClientProfile = {
  id: string
  name: string
  phone_wa: string
  email: string | null
  birth_date: string
  /** أعمدة DNA المباشرة — مصدر النموذج العام */
  flight_seat: string
  food_allergies: string
  favorite_drink: string
  hotel_preference: string
  passport_expiry: string
  /** مرايا تقليدية للعرض والتوافق */
  flight_preferences: string
  hotel_preferences: string
  dietary: string
  secret_notes: string
  dna_interests: string
  dna_special_requests: string
  dna_activity_level: string
  client_type: ClientType
  client_tier: ClientTier
  total_trips: number
  referrals_count: number
  referral_code: string
  lead_source: string
  /** علم المؤثر الموحّد (جدول clients) */
  is_influencer: boolean
  /** علم الليدر الموحّد (جدول clients) */
  is_leader: boolean
  influencer_followers: number
  influencer_commission: number
  /** حقول عرض إضافية (legacy / UI) */
  platforms: string
  content_focus: string
  profile_url: string
  total_spent: number
  total_profit: number
  vip_tier: VipSpendingTier
  sales_stage: string
  used_code: string
  tags: string[]
  target_trip: string
}

export const CLIENT_DNA_ACTIVITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'استرخاء', label: 'استرخاء 🧘' },
  { value: 'متوازن', label: 'متوازن ⚖️' },
  { value: 'مغامرة', label: 'مغامرة 🏔️' },
  { value: 'نشاط عالي', label: 'نشاط عالي 🔥' },
]

export const CLIENT_DNA_INTEREST_SUGGESTIONS = [
  'التسوق',
  'العيادات',
  'الفعاليات',
  'التاريخ',
  'الطبيعة',
  'الفن',
  'المطاعم',
  'السبا',
  'الثقافة',
  'الرياضة',
] as const

export function parseDnaInterests(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(/[,،|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatDnaInterests(interests: string[]): string {
  return interests.filter(Boolean).join('، ')
}

export function activityLevelBadgeClass(level: string): string {
  const s = level.trim()
  if (s.includes('استرخاء')) return 'border-emerald-200/80 bg-emerald-50 text-emerald-900'
  if (s.includes('مغامرة') || s.includes('نشاط')) return 'border-orange-200/80 bg-orange-50 text-orange-900'
  return 'border-[#d4af37]/35 bg-[#d4af37]/10 text-[#1c3d27]'
}

export type ClientDnaAdvancedFields = {
  dna_interests: string
  dna_special_requests: string
  dna_activity_level: string
}

export function pickClientDnaAdvanced(raw: Record<string, unknown>): ClientDnaAdvancedFields {
  return {
    dna_interests: pickText(raw, ['dna_interests', 'interests']),
    dna_special_requests: pickText(raw, ['dna_special_requests', 'special_requests']),
    dna_activity_level: pickText(raw, ['dna_activity_level', 'activity_level']),
  }
}

export function clientDnaAdvancedPayload(fields: ClientDnaAdvancedFields): Record<string, string | null> {
  return {
    dna_interests: fields.dna_interests.trim() || null,
    dna_special_requests: fields.dna_special_requests.trim() || null,
    dna_activity_level: fields.dna_activity_level.trim() || null,
  }
}

export function hasClientDnaAdvanced(fields: Pick<VipClientProfile, 'dna_interests' | 'dna_special_requests' | 'dna_activity_level'>): boolean {
  return Boolean(
    fields.dna_interests?.trim() ||
      fields.dna_special_requests?.trim() ||
      fields.dna_activity_level?.trim(),
  )
}

export function normalizeClientTier(raw: unknown): ClientTier {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (s === 'vvip' || s.includes('vvip')) return 'vvip'
  if (s === 'vip') return 'vip'
  if (s === 'regular' || s.includes('تقليدي') || s === 'تقليدي') return 'regular'
  return 'regular'
}

export function tierDisplayLabel(tier: ClientTier): string {
  if (tier === 'vip') return 'VIP'
  if (tier === 'vvip') return 'VVIP'
  return 'تقليدي (Regular)'
}

export function tierBadgeClassName(tier: ClientTier): string {
  if (tier === 'vip') {
    return 'rounded-full border border-[#d4af37]/60 bg-gradient-to-l from-[#d4af37] to-[#e8c96a] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#001f3f] shadow-sm'
  }
  if (tier === 'vvip') {
    return 'rounded-full border border-[#d4af37]/70 bg-[#001f3f] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#d4af37] shadow-[0_0_14px_rgba(212,175,55,0.55)] ring-1 ring-[#d4af37]/40'
  }
  return 'rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600'
}

function pickNum(raw: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = raw[k]
    if (v != null && v !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return Math.max(0, Math.floor(n))
    }
  }
  return fallback
}

function pickText(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (v == null || v === '') continue
    if (Array.isArray(v)) {
      const joined = v
        .map((item) => (item == null ? '' : String(item).trim()))
        .filter(Boolean)
        .join('، ')
      if (joined) return joined
      continue
    }
    if (typeof v === 'object') continue
    const s = String(v).trim()
    if (s && s !== '[object Object]') return s
  }
  return ''
}

function pick(raw: Record<string, unknown>, keys: string[]): string {
  return pickText(raw, keys)
}

/** أعمدة المؤثر — يجب تضمينها صراحةً في select */
export const CLIENT_INFLUENCER_COLUMNS =
  'is_influencer, platforms, influencer_followers, content_focus, influencer_commission, profile_url' as const

function parseBool(raw: unknown): boolean {
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
  return false
}

function parseCommission(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function isInfluencerClient(client: Pick<VipClientProfile, 'is_influencer'>): boolean {
  return client.is_influencer === true
}

export function isLeaderClient(client: Pick<VipClientProfile, 'is_leader'>): boolean {
  return client.is_leader === true
}

export function resolveInfluencerFollowers(
  client: Pick<VipClientProfile, 'influencer_followers'>,
): number {
  const n = Number(client.influencer_followers)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  return 0
}

export function resolveInfluencerPlatforms(
  client: Pick<VipClientProfile, 'platforms'> & { platform?: string | null },
): string {
  return client.platforms?.trim() || client.platform?.trim() || ''
}

export function resolveInfluencerContentFocus(
  client: Pick<VipClientProfile, 'content_focus'> & { content_niche?: string | null },
): string {
  return client.content_focus?.trim() || client.content_niche?.trim() || ''
}

export function hasInfluencerProfileData(
  client: Pick<VipClientProfile, 'platforms' | 'content_focus' | 'influencer_followers' | 'profile_url'>,
): boolean {
  return Boolean(
    resolveInfluencerPlatforms(client) ||
      resolveInfluencerContentFocus(client) ||
      client.profile_url?.trim() ||
      resolveInfluencerFollowers(client) > 0,
  )
}

export function shouldShowInfluencerCardSection(
  client: Pick<VipClientProfile, 'is_influencer' | 'client_type'>,
): boolean {
  return client.is_influencer === true || client.client_type === 'مؤثر'
}

export function parseClientTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => String(t).trim()).filter(Boolean)
}

/** الرحلة المستهدفة — من target_trip أو وسم tags (target:… أو قروب …) */
export function resolveClientTargetTrip(raw: Record<string, unknown>): string {
  const direct = pick(raw, ['target_trip'])
  if (direct) return direct

  for (const tag of parseClientTags(raw.tags)) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('target:')) return tag.slice(7).trim()
    if (tag.includes('قروب') || tag.startsWith('🏷')) {
      return tag.replace(/^🏷️?\s*/, '').trim()
    }
  }

  return ''
}

/** توحيد صف `clients` من أعمدة VIP أو الحقول القديمة + travel_dna */
export function normalizeVipClient(raw: Record<string, unknown>): VipClientProfile | null {
  const id = raw.id != null ? String(raw.id) : ''
  const dna = parseTravelDnaForm(raw.travel_dna)
  const name = pick(raw, ['name', 'full_name'])
  if (!id || !name) return null

  const drink =
    pick(raw, ['favorite_drink']) ||
    dna.drink_coffee.trim()
  const dietaryFromDna = [pick(raw, ['food_allergies']) || dna.food_allergies.trim(), drink ? `مشروب: ${drink}` : ''].filter(Boolean).join(' · ')

  const client_type = normalizeClientType(raw.client_type)
  const is_influencer = parseBool(raw.is_influencer)
  const is_leader = parseBool(raw.is_leader)
  const influencer_followers = pickNum(raw, ['influencer_followers', 'follower_count', 'followers'])

  return {
    id,
    name,
    phone_wa: pick(raw, ['phone_wa', 'phone_number', 'phone']),
    email: pick(raw, ['email']) || null,
    birth_date:
      raw.birth_date != null && String(raw.birth_date).trim()
        ? String(raw.birth_date).trim().slice(0, 10)
        : '',
    flight_seat: pick(raw, ['flight_seat']) || dna.preferred_seat.trim(),
    food_allergies: pick(raw, ['food_allergies']) || dna.food_allergies.trim(),
    favorite_drink: pick(raw, ['favorite_drink']) || dna.drink_coffee.trim(),
    hotel_preference: pick(raw, ['hotel_preference']) || dna.hotel_style.trim(),
    passport_expiry:
      raw.passport_expiry != null && String(raw.passport_expiry).trim()
        ? String(raw.passport_expiry).trim().slice(0, 10)
        : '',
    flight_preferences:
      pick(raw, ['flight_seat', 'flight_preferences']) || dna.preferred_seat.trim(),
    hotel_preferences:
      pick(raw, ['hotel_preference', 'hotel_preferences']) || dna.hotel_style.trim(),
    dietary:
      pick(raw, ['food_allergies', 'dietary']) || dietaryFromDna,
    secret_notes: pick(raw, ['secret_notes']) || dna.secret_notes.trim(),
    ...pickClientDnaAdvanced(raw),
    client_type,
    client_tier: normalizeClientTier(raw.client_tier ?? raw.tier),
    total_trips: pickNum(raw, ['total_trips', 'trips_count']),
    referrals_count: pickNum(raw, ['referrals_count', 'referral_count']),
    referral_code: pick(raw, ['ref_code', 'referral_code']),
    lead_source: pick(raw, ['lead_source']),
    is_influencer,
    is_leader,
    influencer_followers,
    influencer_commission: parseCommission(raw.influencer_commission),
    platforms: pickText(raw, ['platforms', 'platform', 'social_platforms']),
    content_focus: pickText(raw, ['content_focus', 'content_niche', 'content', 'niche', 'focus']),
    profile_url: pick(raw, ['profile_url']),
    total_spent: parseTotalSpent(raw.total_spent),
    total_profit: parseTotalProfit(raw.total_profit ?? raw.total_spent),
    vip_tier: normalizeVipSpendingTier(raw.vip_tier, raw.total_profit ?? raw.total_spent),
    sales_stage: pick(raw, ['sales_stage']),
    used_code: pick(raw, ['used_code']),
    tags: parseClientTags(raw.tags),
    target_trip: resolveClientTargetTrip(raw),
  }
}

export function buildClientInsertPayload(fields: {
  name: string
  phone_wa: string
  email: string
  birth_date?: string
  flight_seat: string
  food_allergies: string
  favorite_drink: string
  hotel_preference: string
  passport_expiry?: string
  secret_notes: string
  dna_interests?: string
  dna_special_requests?: string
  dna_activity_level?: string
  client_type: ClientType
  client_tier: ClientTier
  total_trips: number
  referrals_count: number
  referral_code?: string
  lead_source?: string
  is_influencer?: boolean
  is_leader?: boolean
  influencer_followers?: number
  influencer_commission?: number
  platforms?: string
  content_focus?: string
  profile_url?: string
  sales_stage?: string
  used_code?: string
}) {
  const name = fields.name.trim()
  const phone_wa = fields.phone_wa.trim()
  const email = fields.email.trim() || null
  const secret_notes = fields.secret_notes.trim() || null

  const directPatch = clientDnaSupabasePatch({
    flight_seat: fields.flight_seat,
    food_allergies: fields.food_allergies,
    favorite_drink: fields.favorite_drink,
    hotel_preference: fields.hotel_preference,
    passport_expiry: fields.passport_expiry?.trim() || null,
    dna_interests: fields.dna_interests ?? '',
    dna_activity_level: fields.dna_activity_level ?? '',
  })

  const travel_dna = {
    ...(typeof directPatch.travel_dna === 'object' && directPatch.travel_dna
      ? (directPatch.travel_dna as Record<string, string>)
      : {}),
    ...serializeTravelDna({
      preferred_seat: fields.flight_seat,
      food_allergies: fields.food_allergies,
      hotel_style: fields.hotel_preference,
      drink_coffee: fields.favorite_drink,
      secret_notes: fields.secret_notes,
    }),
  }

  const isInfluencer = fields.is_influencer === true || fields.client_type === 'مؤثر'
  const isLeader = fields.is_leader === true || (fields.client_type === 'ليدر' && !isInfluencer)
  const client_type: ClientType = isInfluencer
    ? 'مؤثر'
    : isLeader
      ? 'ليدر'
      : 'عميل'

  const payload: Record<string, unknown> = {
    name,
    phone_wa: phone_wa || null,
    email,
    secret_notes,
    ...directPatch,
    travel_dna,
    ...clientDnaAdvancedPayload({
      dna_interests: fields.dna_interests ?? '',
      dna_special_requests: fields.dna_special_requests ?? '',
      dna_activity_level: fields.dna_activity_level ?? '',
    }),
    client_type,
    is_influencer: isInfluencer,
    is_leader: isLeader,
    client_tier: fields.client_tier,
    total_trips: fields.total_trips,
    referrals_count: fields.referrals_count,
    birth_date: fields.birth_date?.trim() || null,
    status: 'new' as const,
  }

  const lead_source = fields.lead_source?.trim() || null
  if (lead_source) payload.lead_source = lead_source

  const sales_stage = fields.sales_stage?.trim() || null
  if (sales_stage) payload.sales_stage = sales_stage

  const used_code = fields.used_code?.trim() || null
  if (used_code) payload.used_code = used_code

  if (fields.referral_code !== undefined) {
    const referral_code = fields.referral_code.trim() || null
    payload.referral_code = referral_code
    payload.ref_code = referral_code
  }

  payload.platforms = fields.platforms?.trim() || null
  const followers =
    fields.influencer_followers != null && Number.isFinite(fields.influencer_followers)
      ? Math.max(0, Math.floor(fields.influencer_followers))
      : null
  payload.influencer_followers = followers
  payload.influencer_commission =
    fields.influencer_commission != null && Number.isFinite(fields.influencer_commission)
      ? parseCommission(fields.influencer_commission)
      : null
  payload.content_focus = fields.content_focus?.trim() || null
  payload.profile_url = fields.profile_url?.trim() || null

  return sanitizeClientWritePayload(payload)
}

/** يضمن إرسال أعمدة clients الموحّدة فقط (بدون full_name / phone_number القديمة) */
export function sanitizeClientWritePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...payload }
  delete clean.full_name
  delete clean.phone_number
  delete clean.phone
  return clean
}

/** Payload for the dedicated referral-code widget (single source of truth). */
export function buildReferralCodeUpdatePayload(code: string | null) {
  const referral_code = code?.trim() || null
  return { referral_code, ref_code: referral_code }
}

export function buildClientUpdatePayload(
  fields: Omit<Parameters<typeof buildClientInsertPayload>[0], 'referral_code'>,
): Omit<ReturnType<typeof buildClientInsertPayload>, 'status'> {
  const { status: _status, ...rest } = buildClientInsertPayload(fields)
  return rest
}

function pickDnaField(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function parseTravelDnaObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
    return {}
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

/** قراءة travel_dna مع دعم المفاتيح البديلة + الأعمدة التقليدية + preferences من onboarding */
export function parseTravelDnaFromClient(client: {
  travel_dna?: unknown
  flight_seat?: string | null
  flight_preferences?: string | null
  food_allergies?: string | null
  favorite_drink?: string | null
  hotel_preference?: string | null
  hotel_preferences?: string | null
  dietary?: string | null
  preferences?: unknown
} | null | undefined): {
  preferred_seat: string
  food_allergies: string
  hotel_style: string
  drink_coffee: string
  secret_notes: string
} {
  const base = parseTravelDnaForm(client?.travel_dna)
  const prefsRoot =
    client?.preferences && typeof client.preferences === 'object' && !Array.isArray(client.preferences)
      ? (client.preferences as Record<string, unknown>)
      : {}
  const travelStyle =
    prefsRoot.travel_style && typeof prefsRoot.travel_style === 'object' && !Array.isArray(prefsRoot.travel_style)
      ? (prefsRoot.travel_style as Record<string, unknown>)
      : {}

  return {
    preferred_seat:
      String(client?.flight_seat ?? '').trim() ||
      base.preferred_seat ||
      String(client?.flight_preferences ?? '').trim(),
    food_allergies:
      String(client?.food_allergies ?? '').trim() ||
      base.food_allergies ||
      String(client?.dietary ?? '').trim() ||
      String(travelStyle.dietary_restrictions ?? '').trim(),
    hotel_style:
      String(client?.hotel_preference ?? '').trim() ||
      base.hotel_style ||
      String(client?.hotel_preferences ?? '').trim(),
    drink_coffee:
      String(client?.favorite_drink ?? '').trim() || base.drink_coffee,
    secret_notes: base.secret_notes,
  }
}

/** قراءة حقل واحد من travel_dna JSON (يدعم flight_seat وغيرها) */
export function readTravelDnaField(
  travelDna: unknown,
  keys: string[],
  legacyFallback?: string | null,
): string {
  const o = parseTravelDnaObject(travelDna)
  return pickDnaField(o, keys) || String(legacyFallback ?? '').trim()
}

/** عمود JSONB `clients.travel_dna` — فقط القيم غير الفارغة */
export function serializeTravelDna(fields: {
  preferred_seat: string
  food_allergies: string
  hotel_style: string
  drink_coffee: string
  secret_notes?: string
}): Record<string, string> {
  const out: Record<string, string> = {}
  const seat = fields.preferred_seat?.trim()
  const food = fields.food_allergies?.trim()
  const hotel = fields.hotel_style?.trim()
  const drink = fields.drink_coffee?.trim()
  const secret = fields.secret_notes?.trim()
  if (seat) out.preferred_seat = seat
  if (food) out.food_allergies = food
  if (hotel) out.hotel_style = hotel
  if (drink) out.drink_coffee = drink
  if (secret) out.secret_notes = secret
  return out
}

export function parseTravelDnaForm(raw: unknown): {
  preferred_seat: string
  food_allergies: string
  hotel_style: string
  drink_coffee: string
  secret_notes: string
} {
  const o = parseTravelDnaObject(raw)
  return {
    preferred_seat: pickDnaField(o, ['preferred_seat', 'flight_seat', 'seat', 'flight_preferences']),
    food_allergies: pickDnaField(o, [
      'food_allergies',
      'food_preference',
      'food_preferences',
      'dietary',
      'dietary_restrictions',
    ]),
    hotel_style: pickDnaField(o, ['hotel_style', 'hotel_preference', 'hotel_preferences', 'hotel_type']),
    drink_coffee: pickDnaField(o, ['drink_coffee', 'favorite_drink', 'drink', 'beverage', 'coffee']),
    secret_notes: pickDnaField(o, ['secret_notes']),
  }
}
