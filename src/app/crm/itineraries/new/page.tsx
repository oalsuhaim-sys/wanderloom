import { redirect } from 'next/navigation';

/** مسار الإنشاء الموحّد — يوجّه إلى مساحة البناء الكاملة مع الحفاظ على معاملات الرابط */
export default async function CreateNewItineraryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) qs.append(key, item);
    }
  }
  const query = qs.toString();
  redirect(query ? `/crm/itineraries/builder?${query}` : '/crm/itineraries/builder');
}
