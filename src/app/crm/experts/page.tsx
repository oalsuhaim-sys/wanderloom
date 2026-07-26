import { redirect } from 'next/navigation';

/** @deprecated استخدم /crm/partners-directory?tab=experts */
export default function ExpertsRedirect() {
  redirect('/crm/partners-directory?tab=experts');
}
