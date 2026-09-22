import { redirect } from 'next/navigation';

/** Canonical handbook lives in CRM shell — keep /admin/docs as alias. */
export default function AdminDocsRedirectPage() {
  redirect('/crm/docs');
}
