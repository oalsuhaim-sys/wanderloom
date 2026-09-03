import type { SupabaseClient } from '@supabase/supabase-js'

import {
  GROUP_MEMBER_STATUSES,
  GROUP_PAYMENT_STATUSES,
  normalizeGroupMemberStatus,
  type GroupMemberStatus,
  type GroupPaymentStatus,
  isGroupPaymentStatus,
} from '@/lib/group-members'

/** Shown on Group Operations board — pending joins + confirmed seats (not rejected). */
export const GROUP_OPERATIONS_MEMBER_STATUSES: readonly GroupMemberStatus[] = [
  'pending_interview',
  'approved',
  'waitlisted',
  'confirmed_seat',
] as const

/** Needs admin attention (not yet a confirmed seat). */
export const GROUP_OPERATIONS_PENDING_STATUSES: readonly GroupMemberStatus[] = [
  'pending_interview',
  'approved',
  'waitlisted',
] as const

export function isPendingGroupJoinStatus(status: GroupMemberStatus): boolean {
  return (GROUP_OPERATIONS_PENDING_STATUSES as readonly string[]).includes(status)
}

export function groupOperationsJoinBadge(status: GroupMemberStatus): {
  label: string
  className: string
} {
  if (status === 'confirmed_seat') {
    return {
      label: 'مقعد مؤكد',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    }
  }
  if (status === 'waitlisted') {
    return {
      label: 'قائمة انتظار',
      className: 'bg-orange-50 text-orange-700 ring-orange-600/20',
    }
  }
  if (status === 'approved') {
    return {
      label: 'تمت الموافقة — بانتظار التأكيد',
      className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    }
  }
  // pending_interview + fallback
  return {
    label: 'طلب جديد (بانتظار التأكيد)',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  }
}

export const RADAR_FULFILLMENT_PENDING = 'بانتظار التنفيذ' as const
export const RADAR_FULFILLMENT_DONE = 'تم التنفيذ' as const

export type RadarFulfillmentStatus = typeof RADAR_FULFILLMENT_PENDING | typeof RADAR_FULFILLMENT_DONE

export type GroupFulfillmentClient = {
  /** group_members.id */
  member_id: string
  /** clients.id — CRM profile link + fulfillment toggle */
  id: string
  group_id: string
  name: string
  phone_wa: string
  target_trip: string
  dna_special_requests: string
  status: GroupMemberStatus
  payment_status: GroupPaymentStatus | null
  radar_fulfillment_status: RadarFulfillmentStatus
}

export type GroupFulfillmentBucket = {
  target_trip: string
  group_id: string
  clients: GroupFulfillmentClient[]
  pendingCount: number
  doneCount: number
}

export type GroupMemberUpdatePayload = {
  customer_name?: string
  customer_phone?: string
  status?: GroupMemberStatus
  payment_status?: GroupPaymentStatus | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function firstEmbedded(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? asRecord(value[0]) : null
  }
  return asRecord(value)
}

function pickTripTitle(trip: Record<string, unknown> | null): string {
  if (!trip) return ''
  return (
    String(trip.title_ar ?? '').trim() ||
    String(trip.title ?? '').trim() ||
    String(trip.title_en ?? '').trim()
  )
}

function pickRadarFulfillment(raw: Record<string, unknown>): unknown {
  return raw.radar_fulfillment ?? raw.radar_fulfillment_status
}

export function normalizeRadarFulfillmentStatus(raw: unknown): RadarFulfillmentStatus {
  const s = String(raw ?? '').trim()
  if (s === RADAR_FULFILLMENT_DONE) return RADAR_FULFILLMENT_DONE
  return RADAR_FULFILLMENT_PENDING
}

function parseMemberStatus(raw: unknown): GroupMemberStatus {
  return normalizeGroupMemberStatus(raw) ?? 'pending_interview'
}

function parsePaymentStatus(raw: unknown): GroupPaymentStatus | null {
  if (raw == null || String(raw).trim() === '') return null
  return isGroupPaymentStatus(raw) ? raw : null
}

/** Map a group_members row (+ optional embeds) into a fulfillment card. */
export function parseGroupFulfillmentMember(raw: Record<string, unknown>): GroupFulfillmentClient | null {
  const client = firstEmbedded(raw.clients)
  const trip = firstEmbedded(raw.group_trips)

  const memberId = raw.id != null ? String(raw.id).trim() : ''
  const groupId = raw.group_id != null ? String(raw.group_id).trim() : ''

  const clientId =
    raw.client_id != null && String(raw.client_id).trim() !== ''
      ? String(raw.client_id)
      : client?.id != null
        ? String(client.id)
        : ''

  // Prefer live clients.name — customer_name on group_members can be stale after CRM edits
  const name =
    String(client?.name ?? '').trim() ||
    String(raw.customer_name ?? '').trim() ||
    (clientId ? `عميل #${clientId}` : '')

  const phone_wa =
    String(client?.phone_wa ?? '').trim() ||
    String(raw.customer_phone ?? '').trim()

  const target_trip = pickTripTitle(trip)
  if (!memberId || !clientId || !target_trip) return null

  return {
    member_id: memberId,
    id: clientId,
    group_id: groupId,
    name,
    phone_wa,
    target_trip,
    dna_special_requests: String(client?.dna_special_requests ?? '').trim(),
    status: parseMemberStatus(raw.status),
    payment_status: parsePaymentStatus(raw.payment_status),
    radar_fulfillment_status: normalizeRadarFulfillmentStatus(
      pickRadarFulfillment(client ?? {}) ?? pickRadarFulfillment(raw),
    ),
  }
}

/** @deprecated Prefer parseGroupFulfillmentMember */
export function parseGroupFulfillmentClient(raw: Record<string, unknown>): GroupFulfillmentClient | null {
  return parseGroupFulfillmentMember(raw)
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
      const sorted = [...bucketClients].sort((a, b) => {
        const aPending = isPendingGroupJoinStatus(a.status) ? 0 : 1
        const bPending = isPendingGroupJoinStatus(b.status) ? 0 : 1
        if (aPending !== bPending) return aPending - bPending
        return a.name.localeCompare(b.name, 'ar')
      })
      const pendingCount = sorted.filter((c) => c.radar_fulfillment_status !== RADAR_FULFILLMENT_DONE).length
      const doneCount = sorted.length - pendingCount
      const group_id = sorted.find((c) => c.group_id)?.group_id ?? ''
      return { target_trip, group_id, clients: sorted, pendingCount, doneCount }
    })
    .sort((a, b) => {
      const aPendingJoins = a.clients.filter((c) => isPendingGroupJoinStatus(c.status)).length
      const bPendingJoins = b.clients.filter((c) => isPendingGroupJoinStatus(c.status)).length
      if (aPendingJoins !== bPendingJoins) return bPendingJoins - aPendingJoins
      return a.target_trip.localeCompare(b.target_trip, 'ar')
    })
}

const MEMBER_SELECT_WITH_EMBEDS = `
  id,
  status,
  payment_status,
  client_id,
  customer_name,
  customer_phone,
  group_id,
  group_trips ( id, title_ar, title_en ),
  clients ( id, name, phone_wa, dna_special_requests, radar_fulfillment, radar_fulfillment_status )
`

const MEMBER_SELECT_LEAN = `
  id,
  status,
  payment_status,
  client_id,
  customer_name,
  customer_phone,
  group_id
`

async function hydrateTrips(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const tripIds = [
    ...new Set(
      rows
        .map((r) =>
          String(r.group_id ?? r.group_trip_id ?? r.trip_id ?? '').trim(),
        )
        .filter(Boolean),
    ),
  ]
  if (tripIds.length === 0) return rows

  const { data: trips } = await supabase
    .from('group_trips')
    .select('id, title_ar, title_en')
    .in('id', tripIds)

  const byId = new Map<string, Record<string, unknown>>()
  for (const t of trips ?? []) {
    const id = (t as { id?: unknown }).id
    if (id == null) continue
    byId.set(String(id), t as Record<string, unknown>)
  }

  return rows.map((row) => {
    const tripId = String(row.group_id ?? row.group_trip_id ?? row.trip_id ?? '').trim()
    const trip = tripId ? byId.get(tripId) : undefined
    return trip ? { ...row, group_trips: trip } : row
  })
}

async function hydrateClients(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const needsClient = rows.some((r) => {
    const hasName = String(r.customer_name ?? '').trim()
    const hasClientEmbed = firstEmbedded(r.clients) != null
    return !hasName || !hasClientEmbed
  })
  if (!needsClient) return rows

  const clientIds = [
    ...new Set(
      rows
        .map((r) => (r.client_id != null ? String(r.client_id).trim() : ''))
        .filter(Boolean),
    ),
  ]
  if (clientIds.length === 0) return rows

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone_wa, dna_special_requests, radar_fulfillment, radar_fulfillment_status')
    .in('id', clientIds)

  const byId = new Map<string, Record<string, unknown>>()
  for (const c of clients ?? []) {
    const id = (c as { id?: unknown }).id
    if (id == null) continue
    byId.set(String(id), c as Record<string, unknown>)
  }

  return rows.map((row) => {
    if (firstEmbedded(row.clients)) return row
    const cid = row.client_id != null ? String(row.client_id) : ''
    const client = cid ? byId.get(cid) : undefined
    return client ? { ...row, clients: client } : row
  })
}

async function mapMemberRows(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  opts?: { hydrateTrips?: boolean },
): Promise<GroupFulfillmentClient[]> {
  let next = rows
  if (opts?.hydrateTrips) {
    next = await hydrateTrips(supabase, next)
  } else {
    const missingTrip = next.some((r) => !pickTripTitle(firstEmbedded(r.group_trips)))
    if (missingTrip) next = await hydrateTrips(supabase, next)
  }
  next = await hydrateClients(supabase, next)
  return next
    .map(parseGroupFulfillmentMember)
    .filter((c): c is GroupFulfillmentClient => c != null)
}

function keepOperationsBoardMembers(clients: GroupFulfillmentClient[]): GroupFulfillmentClient[] {
  const allowed = new Set<string>(GROUP_OPERATIONS_MEMBER_STATUSES)
  return clients.filter((c) => allowed.has(c.status))
}

/**
 * Operations board: pending joins + confirmed seats in group_members.
 * Fetch the pivot table without a status `.in()` so confirmed_seat / confirmed both load.
 */
export async function fetchGroupFulfillmentClients(
  supabase: SupabaseClient,
): Promise<{ clients: GroupFulfillmentClient[]; error?: string }> {
  const { data, error } = await supabase
    .from('group_members')
    .select(MEMBER_SELECT_WITH_EMBEDS)

  if (
    error &&
    /relationship|more than one|column|schema cache|does not exist|could not find/i.test(
      error.message ?? '',
    )
  ) {
    const lean = await supabase.from('group_members').select(MEMBER_SELECT_LEAN)

    if (lean.error) {
      const minimal = await supabase
        .from('group_members')
        .select('id, status, payment_status, client_id, group_id, group_trip_id, trip_id')

      const retry =
        minimal.error && /group_trip_id|trip_id|column|schema cache|does not exist/i.test(minimal.error.message ?? '')
          ? await supabase
              .from('group_members')
              .select('id, status, payment_status, client_id, group_id')
          : minimal

      if (retry.error) {
        console.error('Error fetching operations:', retry.error)
        return { clients: [], error: retry.error.message }
      }

      const clients = keepOperationsBoardMembers(
        await mapMemberRows(
          supabase,
          (retry.data ?? []) as Record<string, unknown>[],
          { hydrateTrips: true },
        ),
      )
      return { clients }
    }

    const clients = keepOperationsBoardMembers(
      await mapMemberRows(
        supabase,
        (lean.data ?? []) as Record<string, unknown>[],
        { hydrateTrips: true },
      ),
    )
    return { clients }
  }

  if (error) {
    console.error('Error fetching operations:', error)
    return { clients: [], error: error.message }
  }

  const clients = keepOperationsBoardMembers(
    await mapMemberRows(supabase, (data ?? []) as Record<string, unknown>[]),
  )
  return { clients }
}

/** Pending group join seats awaiting confirmation (matches notification badge). */
export async function countPendingGroupOperationsMembers(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .in('status', [...GROUP_OPERATIONS_PENDING_STATUSES])

  if (!error) return count ?? 0

  console.warn('[countPendingGroupOperationsMembers]', error.message)
  let total = 0
  for (const status of GROUP_OPERATIONS_PENDING_STATUSES) {
    const single = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)
    if (!single.error) total += single.count ?? 0
  }
  return total
}

async function adjustBookedSeats(
  supabase: SupabaseClient,
  tripId: string,
  delta: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!tripId || delta === 0) return { ok: true }

  const { data: trip, error: tripErr } = await supabase
    .from('group_trips')
    .select('id, booked_seats')
    .eq('id', tripId)
    .maybeSingle()

  if (tripErr) return { ok: false, error: tripErr.message }
  if (!trip) return { ok: true }

  const current = Math.max(0, Number((trip as { booked_seats?: unknown }).booked_seats) || 0)
  const next = Math.max(0, current + delta)

  const { error } = await supabase
    .from('group_trips')
    .update({ booked_seats: next })
    .eq('id', tripId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteGroupFulfillmentMember(
  supabase: SupabaseClient,
  memberId: string,
  tripId: string,
  opts?: { wasConfirmedSeat?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const id = String(memberId ?? '').trim()
  if (!id) return { ok: false, error: 'معرّف العضوية غير صالح.' }

  const { error } = await supabase.from('group_members').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  if (opts?.wasConfirmedSeat !== false) {
    const seat = await adjustBookedSeats(supabase, String(tripId ?? '').trim(), -1)
    if (!seat.ok) {
      return {
        ok: true,
        error: seat.error
          ? `تم الحذف، لكن تعذر تحديث المقاعد المحجوزة: ${seat.error}`
          : undefined,
      }
    }
  }

  return { ok: true }
}

export async function updateGroupFulfillmentMember(
  supabase: SupabaseClient,
  memberId: string,
  previous: Pick<GroupFulfillmentClient, 'group_id' | 'status'>,
  updatedData: GroupMemberUpdatePayload,
): Promise<{ ok: boolean; error?: string; leftBoard?: boolean }> {
  const id = String(memberId ?? '').trim()
  if (!id) return { ok: false, error: 'معرّف العضوية غير صالح.' }

  const payload: Record<string, unknown> = {}
  if (updatedData.customer_name !== undefined) {
    payload.customer_name = String(updatedData.customer_name).trim()
  }
  if (updatedData.customer_phone !== undefined) {
    payload.customer_phone = String(updatedData.customer_phone).trim()
  }
  if (updatedData.status !== undefined) {
    const normalized = normalizeGroupMemberStatus(updatedData.status);
    if (!normalized) {
      return { ok: false, error: 'حالة العضوية غير صالحة.' }
    }
    payload.status = normalized
  }
  if (updatedData.payment_status !== undefined) {
    if (
      updatedData.payment_status != null &&
      !GROUP_PAYMENT_STATUSES.includes(updatedData.payment_status)
    ) {
      return { ok: false, error: 'حالة السداد غير صالحة.' }
    }
    payload.payment_status = updatedData.payment_status
  }

  const { error } = await supabase.from('group_members').update(payload).eq('id', id)
  if (error) return { ok: false, error: error.message }

  const nextStatus = updatedData.status ?? previous.status
  const wasConfirmed = previous.status === 'confirmed_seat'
  const nowConfirmed = nextStatus === 'confirmed_seat'
  let seatDelta = 0
  if (wasConfirmed && !nowConfirmed) seatDelta = -1
  if (!wasConfirmed && nowConfirmed) seatDelta = 1

  if (seatDelta !== 0 && previous.group_id) {
    const seat = await adjustBookedSeats(supabase, previous.group_id, seatDelta)
    if (!seat.ok) {
      return {
        ok: true,
        leftBoard: !nowConfirmed,
        error: seat.error
          ? `تم التحديث، لكن تعذر تحديث المقاعد المحجوزة: ${seat.error}`
          : undefined,
      }
    }
  }

  return { ok: true, leftBoard: !nowConfirmed }
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
