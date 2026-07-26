import { redirect } from 'next/navigation';

/** @deprecated استخدم /crm/partners-directory?tab=leaders */
export default function LeadersRedirect() {
  redirect('/crm/partners-directory?tab=leaders');
}
