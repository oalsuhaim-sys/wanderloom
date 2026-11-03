import { Suspense } from 'react'

import { fetchClientDirectoryAction } from '@/app/actions/clientDirectoryActions'
import { ClientsLoyaltyClient } from '@/app/crm/clients/ClientsLoyaltyClient'
import type { ClientDirectoryPayload } from '@/app/crm/clients/useClientDirectory'
import type { VipClientProfile } from '@/lib/clientsTravelDna'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 10

function uniqueClientsById(rows: VipClientProfile[]): VipClientProfile[] {
  const seen = new Set<string>()
  const out: VipClientProfile[] = []
  for (const row of rows) {
    const id = String(row.id ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

function buildStatsFromRows(rows: VipClientProfile[]): Pick<
  ClientDirectoryPayload,
  'tripCounts' | 'profitTotals'
> {
  const tripCounts: Record<string, number> = {}
  const profitTotals: Record<string, number> = {}
  for (const row of rows) {
    const id = String(row.id ?? '').trim()
    if (!id) continue
    tripCounts[id] = Math.max(0, Math.floor(Number(row.total_trips) || 0))
    profitTotals[id] = Number(row.total_profit ?? row.lifetime_value ?? 0) || 0
  }
  return { tripCounts, profitTotals }
}

async function prefetchClientDirectory(): Promise<ClientDirectoryPayload> {
  const empty: ClientDirectoryPayload = { rows: [], tripCounts: {}, profitTotals: {} }
  try {
    createSupabaseAdminClient()
    const result = await fetchClientDirectoryAction(null, {
      skipBackfill: true,
    })
    if (!result.ok) {
      console.error('Error fetching clients:', result.error)
      const message = String(result.error ?? '')
      if (/fetch failed|network|ECONN|ENOTFOUND|Failed to fetch|getaddrinfo|socket/i.test(message)) {
        throw new Error(message || 'تعذر الاتصال بقاعدة العملاء.')
      }
      return empty
    }
    const rows = uniqueClientsById(result.rows ?? [])
    return { rows, ...buildStatsFromRows(rows) }
  } catch (err) {
    console.error('Error fetching clients:', err)
    const message = err instanceof Error ? err.message : String(err ?? '')
    if (/fetch failed|network|ECONN|ENOTFOUND|Failed to fetch|getaddrinfo|socket/i.test(message)) {
      throw err
    }
    return empty
  }
}

/** Streams directory rows — does not block the route shell (see loading.tsx + Suspense). */
async function ClientsDirectoryStream() {
  const initialData = await prefetchClientDirectory()
  return <ClientsLoyaltyClient initialData={initialData} />
}

/**
 * Sync page shell — navigation resolves immediately; data loads in Suspense.
 */
export default function ClientsLoyaltyPage() {
  return (
    <Suspense fallback={<ClientsLoyaltyClient initialData={null} />}>
      <ClientsDirectoryStream />
    </Suspense>
  )
}
