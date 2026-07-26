import { redirect } from 'next/navigation';

/** @deprecated — استخدم /crm/marketing/strategy */
export default function MarketingAiRedirectPage() {
  redirect('/crm/marketing/strategy');
}
