import { redirect } from 'next/navigation';

/** Alias — CRM settings live under /crm/settings */
export default function DashboardSettingsRedirect() {
  redirect('/crm/settings');
}
