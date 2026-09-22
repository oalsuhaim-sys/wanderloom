import { redirect } from 'next/navigation';

/** Canonical unified marketing hub lives at /crm/marketing — keep /admin/marketing as alias. */
export default function AdminMarketingRedirectPage() {
  redirect('/crm/marketing');
}
