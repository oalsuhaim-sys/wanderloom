import { redirect } from 'next/navigation';

/** Alias requested in product docs — CRM lives under /crm */
export default function DashboardAccountsRedirect() {
  redirect('/crm/accounts');
}
