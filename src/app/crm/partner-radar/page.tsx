import { redirect } from 'next/navigation';

/** @deprecated استخدم /crm/partners-radar */
export default function PartnerRadarRedirect() {
  redirect('/crm/partners-radar');
}
