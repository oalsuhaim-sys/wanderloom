import type { SupabaseClient } from '@supabase/supabase-js'

import { SALES_STAGE_CONFIRMED } from '@/lib/client-sales-stage'
import { resolveClientTargetTrip } from '@/lib/clientsTravelDna'

export const RADAR_FULFILLMENT_PENDING = 'بانتظار التنفيذ' as const
export const RADAR_FULFILLMENT_DONE = 'تم التنفيذ' as const

export type RadarFulfillmentStatus = typeof RADAR_FULFILLMENT_PENDING | typeof RADAR_FULFILLMENT_DONE

export type GroupFulfillmentClient = {
  id: string
  name: string
  phone_wa: string
  target_trip: string
  dna_special_requests: string
  radar_fulfillment_status: RadarFulfillmentStatus
}

export type GroupFulfillmentBucket = {
  target_trip: string
  clients: GroupFulfillmentClient[]
  pendingCount: number
  doneCount: number
}

function pickPhone(raw: Record<string, unknown>): string {
  return String(raw.phone_wa ?? '').trim()
}

function pickName(raw: Record<string, unknown>): string {
  return String(raw.name ?? '').trim()
}

function pickRadarFulfillment(raw: Record<string, unknown>): unknown {
  return raw.radar_fulfillment ?? raw.radar_fulfillment_status
}

export function normalizeRadarFulfillmentStatus(raw: unknown): RadarFulfillmentStatus {
  const s = String(raw ?? '').trim()
  if (s === RADAR_FULFILLMENT_DONE) return RADAR_FULFILLMENT_DONE
  return RADAR_FULFILLMENT_PENDING
}

export function parseGroupFulfillmentClient(raw: Record<string, unknown>): GroupFulfillmentClient | null {
  const id = raw.id != null ? String(raw.id) : ''
  const name = pickName(raw)
  const target_trip = String(raw.target_trip ?? '').trim() || resolveClientTargetTrip(raw)
  if (!id || !name || !target_trip) return null

  return {
    id,
    name,
    phone_wa: pickPhone(raw),
    target_trip,
    dna_special_requests: String(raw.dna_special_requests ?? '').trim(),
    radar_fulfillment_status: normalizeRadarFulfillmentStatus(pickRadarFulfillment(raw)),
  }
}

export function groupFulfillmentClients(clients: GroupFulfillmentClient[]): GroupFulfillmentBucket[] {
  const map = new Map<string, GroupFulfillmentClient[]>()

  for (const client of clients) {
    const key = client.target_trip.trim()
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(client)
    map.set(key, list)
  }

  return Array.from(map.entries())
    .map(([target_trip, bucketClients]) => {
      const sorted = [...bucketClients].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      const pendingCount = sorted.filter((c) => c.radar_fulfillment_status !== RADAR_FULFILLMENT_DONE).length
      const doneCount = sorted.length - pendingCount
      return { target_trip, clients: sorted, pendingCount, doneCount }
    })
    .sort((a, b) => a.target_trip.localeCompare(b.target_trip, 'ar'))
}

const GROUP_FULFILLMENT_SELECT =
  'id, name, phone_wa, target_trip, dna_special_requests, radar_fulfillment, sales_stage'

export async function fetchGroupFulfillmentClients(
  supabase: SupabaseClient,
): Promise<{ clients: GroupFulfillmentClient[]; error?: string }> {
  const { data, error } = await supabase
    .from('clients')
    .select(GROUP_FULFILLMENT_SELECT)
    .eq('sales_stage', SALES_STAGE_CONFIRMED)
    .not('target_trip', 'is', null)
    .neq('target_trip', '')
    .order('target_trip', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return { clients: [], error: error.message }
  }

  const clients = ((data ?? []) as Record<string, unknown>[])
    .map(parseGroupFulfillmentClient)
    .filter((c): c is GroupFulfillmentClient => c != null)

  return { clients }
}

export async function updateRadarFulfillmentStatus(
  supabase: SupabaseClient,
  clientId: string,
  status: RadarFulfillmentStatus,
): Promise<{ ok: boolean; error?: string }> {
  let { error } = await supabase
    .from('clients')
    .update({ radar_fulfillment: status } as never)
    .eq('id', clientId)

  if (error && (error.message ?? '').includes('radar_fulfillment')) {
    const fallback = await supabase
      .from('clients')
      .update({ radar_fulfillment_status: status })
      .eq('id', clientId)
    error = fallback.error
  }

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
