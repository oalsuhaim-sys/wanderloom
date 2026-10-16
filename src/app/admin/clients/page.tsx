import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic';
/** Legacy /admin/clients → CRM clients directory */
export default function AdminClientsRedirectPage() {
  redirect('/crm/clients')
}
