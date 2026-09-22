import { ClientsLoyaltyClient } from '@/app/crm/clients/ClientsLoyaltyClient'

/**
 * Instant navigation shell — shown while the RSC stream / Suspense boundary
 * resolves. Keeps chrome visible; table/cards use the row skeleton only.
 */
export default function ClientsDirectoryLoading() {
  return <ClientsLoyaltyClient initialData={null} />
}
