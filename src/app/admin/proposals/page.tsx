import { redirect } from 'next/navigation';

/** Canonical proposals list lives in CRM — keep /admin/proposals as alias. */
export default function AdminProposalsRedirectPage() {
  redirect('/crm/quotations');
}
