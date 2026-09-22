import { redirect } from 'next/navigation'

/** Legacy /admin/clients → CRM clients directory */
export default function AdminClientsRedirectPage() {
  redirect('/crm/clients')
}
