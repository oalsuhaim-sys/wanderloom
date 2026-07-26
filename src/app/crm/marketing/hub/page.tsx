import { redirect } from 'next/navigation';

/** @deprecated — استخدم /crm/marketing */
export default function MarketingHubRedirectPage() {
  redirect('/crm/marketing');
}
