import { redirect } from 'next/navigation';

/** Alias for the Expert Handbook. */
export default function AdminHandbookRedirectPage() {
  redirect('/crm/docs');
}
