import type { VipClientProfile } from '@/lib/clientsTravelDna'
import { DEFAULT_CLIENT_TYPE } from '@/lib/clientsTravelDna'
import {
  CLIENT_DATABASE_LEAD_STATUSES,
  LEAD_STATUS_LABEL_AR,
  normalizeLeadStatus,
  type LeadStatus,
} from '@/lib/lead-status'

export { CLIENT_DATABASE_LEAD_STATUSES }

export type ClientDirectoryRow = VipClientProfile & {
  /** Linked pipeline lead id (SSOT) */
  lead_id: string | null
  lead_status: LeadStatus | null
  /** True when row comes from leads and may not have a clients PK yet */
  from_lead: boolean
}

function emptyVipProfile(partial: Partial<VipClientProfile> & Pick<VipClientProfile, 'id' | 'name'>): VipClientProfile {
  return {
    id: partial.id,
    name: partial.name,
    phone_wa: partial.phone_wa ?? '',
    email: partial.email ?? null,
    birth_date: partial.birth_date ?? '',
    flight_seat: partial.flight_seat ?? '',
    food_allergies: partial.food_allergies ?? '',
    favorite_drink: partial.favorite_drink ?? '',
    hotel_preference: partial.hotel_preference ?? '',
    passport_expiry: partial.passport_expiry ?? '',
    flight_preferences: partial.flight_preferences ?? '',
    hotel_preferences: partial.hotel_preferences ?? '',
    dietary: partial.dietary ?? '',
    secret_notes: partial.secret_notes ?? '',
    dna_interests: partial.dna_interests ?? '',
    dna_special_requests: partial.dna_special_requests ?? '',
    dna_activity_level: partial.dna_activity_level ?? '',
    client_type: partial.client_type ?? DEFAULT_CLIENT_TYPE,
    client_tier: partial.client_tier ?? 'regular',
    total_trips: partial.total_trips ?? 0,
    referrals_count: partial.referrals_count ?? 0,
    referral_code: partial.referral_code ?? '',
    lead_source: partial.lead_source ?? '',
    is_influencer: partial.is_influencer ?? false,
    is_leader: partial.is_leader ?? false,
    influencer_followers: partial.influencer_followers ?? 0,
    influencer_commission: partial.influencer_commission ?? 0,
    platforms: partial.platforms ?? '',
    content_focus: partial.content_focus ?? '',
    profile_url: partial.profile_url ?? '',
    total_spent: partial.total_spent ?? 0,
    total_profit: partial.total_profit ?? 0,
    vip_tier: partial.vip_tier ?? 'gold',
    sales_stage: partial.sales_stage ?? '',
    used_code: partial.used_code ?? '',
    tags: partial.tags ?? [],
    target_trip: partial.target_trip ?? '',
  }
}

function destLabel(lead: Record<string, unknown>): string {
  if (Array.isArray(lead.destinations)) {
    return (lead.destinations as unknown[]).map(String).filter(Boolean).join(' · ')
  }
  return String(lead.destinations ?? '').trim()
}

/** Map a leads row → directory card (clients fields filled when available) */
export function mapLeadToClientDirectoryRow(
  lead: Record<string, unknown>,
  client?: VipClientProfile | null,
  opts?: { forceInclude?: boolean },
): ClientDirectoryRow | null {
  const leadId = lead.id != null ? String(lead.id).trim() : ''
  if (!leadId) return null

  const status = normalizeLeadStatus(lead.status)

  if (opts?.forceInclude) {
    // TEMP diagnose override: never drop for status (caller may still skip rejected)
  } else {
    // Hide only radar inbox + rejected. Everything else in CLIENT_DATABASE set is shown.
    if (status === 'radar_pending' || status === 'radar_rejected') {
      return null
    }
    if (!CLIENT_DATABASE_LEAD_STATUSES.includes(status)) {
      return null
    }
  }

  const fullName = String(lead.full_name ?? lead.name ?? '').trim()
  const name = (client?.name || fullName || 'عميل بدون اسم').trim()

  const leadClientId =
    lead.client_id != null && String(lead.client_id).trim() !== ''
      ? String(lead.client_id).trim()
      : ''
  const liveClientId =
    client?.id != null && String(client.id).trim() !== '' ? String(client.id).trim() : ''
  const clientId = liveClientId || leadClientId
  const hasLiveClient = Boolean(client && liveClientId)

  const base = hasLiveClient && client
    ? { ...client, name: client.name?.trim() || name }
    : emptyVipProfile({
        id: `lead:${leadId}`,
        name,
        phone_wa: String(lead.phone_wa ?? '').trim(),
        email: lead.email != null ? String(lead.email).trim() || null : null,
        referral_code: String(lead.referral_code ?? '').trim(),
        lead_source: 'website_lead',
        sales_stage: LEAD_STATUS_LABEL_AR[status] || status,
        target_trip: destLabel(lead),
      })

  return {
    ...base,
    // Prefer real clients.id; otherwise force visible lead stub (never drop Faris-type rows)
    id: hasLiveClient ? liveClientId : `lead:${leadId}`,
    name,
    phone_wa: base.phone_wa || String(lead.phone_wa ?? '').trim(),
    email: base.email || (lead.email != null ? String(lead.email).trim() || null : null),
    lead_id: leadId,
    lead_status: status,
    from_lead: !hasLiveClient,
  }
}

export function isLeadOnlyDirectoryId(id: string): boolean {
  return String(id).startsWith('lead:')
}

export function parseLeadIdFromDirectoryId(id: string): string | null {
  const raw = String(id)
  if (raw.startsWith('lead:')) return raw.slice(5) || null
  return null
}

/**
 * Normalize SA WhatsApp phones for dedupe:
 * +966539002320 / 00966539002320 / 0539002320 → "539002320"
 */
export function normalizeDirectoryPhone(phone: unknown): string {
  if (phone == null) return ''
  let p = String(phone)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, '')
  if (!p) return ''
  if (p.startsWith('00966')) p = p.slice(5)
  else if (p.startsWith('966')) p = p.slice(3)
  if (p.startsWith('0')) p = p.slice(1)
  return p
}

/** @deprecated Use normalizeDirectoryPhone — kept for existing imports */
export function directoryPhoneKey(raw: unknown): string {
  return normalizeDirectoryPhone(raw)
}

function preferPhoneDisplay(a: string, b: string): string {
  const left = String(a ?? '').trim()
  const right = String(b ?? '').trim()
  if (!left) return right
  if (!right) return left
  // Prefer E.164-ish international form when both exist
  if (left.startsWith('+') && !right.startsWith('+')) return left
  if (right.startsWith('+') && !left.startsWith('+')) return right
  return left.length >= right.length ? left : right
}

/**
 * Merge lead stubs + clients rows that share the same normalized phone.
 * Prefer real `clients.id` for relational integrity.
 */
export function dedupeClientDirectoryRows(rows: ClientDirectoryRow[]): ClientDirectoryRow[] {
  const byKey = new Map<string, ClientDirectoryRow>()

  for (const item of rows) {
    const normPhone = normalizeDirectoryPhone(item.phone_wa)
    const key = normPhone ? `p:${normPhone}` : `id:${item.id}`

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      continue
    }

    const existingIsClient = !existing.from_lead && !isLeadOnlyDirectoryId(existing.id)
    const incomingIsClient = !item.from_lead && !isLeadOnlyDirectoryId(item.id)

    // Prefer the clients-table row as the base (stable PK)
    const base = existingIsClient ? existing : incomingIsClient ? item : existing
    const other = base === existing ? item : existing

    byKey.set(key, {
      ...other,
      ...base,
      id: existingIsClient ? existing.id : incomingIsClient ? item.id : base.id,
      name: (base.name || other.name || 'عميل بدون اسم').trim(),
      phone_wa: preferPhoneDisplay(base.phone_wa, other.phone_wa),
      email: base.email || other.email || null,
      lead_id: base.lead_id || other.lead_id || null,
      lead_status: base.lead_status ?? other.lead_status ?? null,
      from_lead: !(existingIsClient || incomingIsClient),
      sales_stage: base.sales_stage || other.sales_stage || '',
      target_trip: base.target_trip || other.target_trip || '',
      referral_code: base.referral_code || other.referral_code || '',
      lead_source: base.lead_source || other.lead_source || '',
    })
  }

  return Array.from(byKey.values())
}
