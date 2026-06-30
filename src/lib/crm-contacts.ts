import {
  isInfluencerClient,
  isLeaderClient,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'

export type ContactTabId = 'all' | 'clients' | 'leaders' | 'influencers'

export const CONTACT_TABS: {
  id: ContactTabId
  label: string
  emoji: string
}[] = [
  { id: 'all', label: 'الكل', emoji: '' },
  { id: 'clients', label: 'العملاء', emoji: '💼' },
  { id: 'leaders', label: 'الليدرز', emoji: '🚀' },
  { id: 'influencers', label: 'المؤثرين', emoji: '🌟' },
]

export function filterClientsByTab(
  clients: VipClientProfile[],
  tab: ContactTabId,
): VipClientProfile[] {
  if (tab === 'all') return clients
  if (tab === 'influencers') return clients.filter((c) => isInfluencerClient(c))
  if (tab === 'leaders') return clients.filter((c) => isLeaderClient(c))
  return clients.filter((c) => !isInfluencerClient(c) && !isLeaderClient(c))
}

export function searchClients(clients: VipClientProfile[], query: string): VipClientProfile[] {
  const q = query.trim().toLowerCase()
  if (!q) return clients

  return clients.filter((c) => {
    const blob = [
      c.name,
      c.phone_wa,
      c.email,
      c.referral_code,
      c.client_type,
      c.platforms,
      c.content_focus,
      String(c.influencer_followers),
      String(c.influencer_commission),
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
    ]
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
}

export function countClientsByTab(
  clients: VipClientProfile[],
): Record<ContactTabId, number> {
  return {
    all: clients.length,
    clients: clients.filter((c) => !isInfluencerClient(c) && !isLeaderClient(c)).length,
    leaders: clients.filter((c) => isLeaderClient(c)).length,
    influencers: clients.filter((c) => isInfluencerClient(c)).length,
  }
}
