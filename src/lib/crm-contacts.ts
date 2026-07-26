import type { VipClientProfile } from '@/lib/clientsTravelDna'

export type ContactTabId = 'all' | 'clients'

export const CONTACT_TABS: {
  id: ContactTabId
  label: string
  emoji: string
}[] = [
  { id: 'all', label: 'الكل', emoji: '' },
  { id: 'clients', label: 'العملاء', emoji: '💼' },
]

/**
 * Normalize Arabic text for resilient partial search:
 * - Unicode NFKC
 * - Alef / Ya / Ta-marbuta variants
 * - Collapse whitespace
 */
export function normalizeSearchText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // harakat
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
}

/** كل صفوف clients — بما فيها VIP والمؤثرين والليدرز إن وُجدوا كعملاء رحلات */
export function filterClientsByTab<T extends VipClientProfile>(
  clients: T[],
  _tab: ContactTabId,
): T[] {
  return clients
}

export function searchClients<T extends VipClientProfile>(
  clients: T[],
  query: string,
): T[] {
  const q = normalizeSearchText(query)
  if (!q) return clients

  return clients.filter((c) => {
    const blob = normalizeSearchText(
      [
        c.name,
        c.phone_wa,
        c.email,
        c.referral_code,
        c.client_type,
        c.client_tier,
        c.vip_tier,
        c.flight_seat,
        c.flight_preferences,
        c.food_allergies,
        c.favorite_drink,
        c.hotel_preference,
        c.hotel_preferences,
        c.passport_expiry,
        c.dietary,
        c.dna_interests,
        c.dna_special_requests,
        c.dna_activity_level,
        c.lead_source,
        c.sales_stage,
        c.target_trip,
        ...(Array.isArray(c.tags) ? c.tags : []),
        c.is_influencer ? 'مؤثر influencer vip' : '',
        c.is_leader ? 'ليدر leader' : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    return blob.includes(q)
  })
}

export function countClientsByTab(
  clients: VipClientProfile[],
): Record<ContactTabId, number> {
  return {
    all: clients.length,
    clients: clients.length,
  }
}
