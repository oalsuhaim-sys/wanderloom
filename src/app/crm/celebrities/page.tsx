import { redirect } from 'next/navigation';

/** @deprecated استخدم /crm/partners-directory?tab=celebrities */
export default function CelebritiesRedirect() {
  redirect('/crm/partners-directory?tab=celebrities');
}
