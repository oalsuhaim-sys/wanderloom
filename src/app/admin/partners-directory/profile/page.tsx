import { redirect } from 'next/navigation'

/** توافق /admin → /crm */
export default async function AdminPartnersProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item)
    }
  }
  const query = qs.toString()
  redirect(query ? `/crm/partners-directory/profile?${query}` : '/crm/partners-directory')
}
