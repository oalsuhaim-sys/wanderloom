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
  return String(raw.phone_wa ?? raw.phone ?? '').trim()
}

function pickName(raw: Record<string, unknown>): string {
  return String(raw.name ?? '').trim()
}

export function normalizeRadarFulfillmentStatus(raw: unknown): RadarFulfillmentStatus {
  const s = String(raw ?? '').trim()
  if (s === RADAR_FULFILLMENT_DONE) return RADAR_FULFILLMENT_DONE
  return RADAR_FULFILLMENT_PENDING
}

export function parseGroupFulfillmentClient(raw: Record<string, unknown>): GroupFulfillmentClient | null {
  const id = raw.id != null ? String(raw.id) : ''
  const name = pickName(raw)
  const target_trip = resolveClientTargetTrip(raw)
  if (!id || !name || !target_trip) return null

  return {
    id,
    name,
    phone_wa: pickPhone(raw),
    target_trip,
    dna_special_requests: String(raw.dna_special_requests ?? '').trim(),
    radar_fulfillment_status: normalizeRadarFulfillmentStatus(raw.radar_fulfillment_status),
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

export async function fetchGroupFulfillmentClients(
  supabase: SupabaseClient,
): Promise<{ clients: GroupFulfillmentClient[]; warning?: string }> {
  const primary = await supabase
    .from('clients')
    .select('id, name, phone_wa, phone, target_trip, tags, dna_special_requests, radar_fulfillment_status, sales_stage')
    .eq('sales_stage', SALES_STAGE_CONFIRMED)
    .not('target_trip', 'is', null)
    .neq('target_trip', '')

  let rows = (primary.data ?? []) as Record<string, unknown>[]
  let warning: string | undefined

  if (primary.error) {
    const msg = primary.error.message ?? ''
    if (msg.includes('column') || msg.includes('sales_stage') || msg.includes('target_trip')) {
      warning =
        'بعض أعمدة القروبات غير متوفرة — نفّذ clients_sales_stage.sql و clients_target_trip.sql و clients_radar_fulfillment.sql'
      const fallback = await supabase
        .from('clients')
        .select('id, name, phone_wa, phone, tags, dna_special_requests')
      if (fallback.error) {
        return { clients: [], warning: fallback.error.message }
      }
      rows = (fallback.data ?? []) as Record<string, unknown>[]
    } else {
      return { clients: [], warning: msg }
    }
  } else {
    rows = rows.filter((raw) => String(raw.sales_stage ?? '').trim() === SALES_STAGE_CONFIRMED)
  }

  const clients = rows
    .map(parseGroupFulfillmentClient)
    .filter((c): c is GroupFulfillmentClient => c != null)

  return { clients, warning }
}

export async function updateRadarFulfillmentStatus(
  supabase: SupabaseClient,
  clientId: string,
  status: RadarFulfillmentStatus,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('clients')
    .update({ radar_fulfillment_status: status })
    .eq('id', clientId)

  if (error) {
    if ((error.message ?? '').includes('radar_fulfillment_status')) {
      return {
        ok: false,
        error: 'عمود radar_fulfillment_status غير موجود — نفّذ supabase/sql/clients_radar_fulfillment.sql',
      }
    }
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
