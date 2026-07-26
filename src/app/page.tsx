export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * قائمة الدول ومدن كل دولة في نموذج «سجّل رحلتك» لا تُعرَّف هنا؛ المصدر الوحيد هو
 * `TRIP_DESTINATIONS` في `src/lib/trip-destination-data.ts` — قائمة حصرية من 21 دولة ومدنها.
 */
import { fetchPublicSessions } from '@/lib/fetch-public-sessions';

import { PublicHomePage } from './_components/home/PublicHomePage';

export const metadata = {
  title: 'Wanderloom — هندسة الرحلات الفاخرة',
  description:
    'Wanderloom: جلسات استشارية، مسارات مصممة، ومجموعات سياحية. سجّل اهتمامك وخطط رحلتك مع فريق متخصص.',
};

export default async function Home() {
  const { sessions, error, demo } = await fetchPublicSessions();

  return (
    <PublicHomePage sessions={sessions} sessionsLoadError={error} sessionsDemo={demo} />
  );
}
