import { redirect } from 'next/navigation';

/** @deprecated — campaigns merged into unified hub at /crm/marketing */
export default function MarketingCampaignsRedirectPage() {
  redirect('/crm/marketing');
}
