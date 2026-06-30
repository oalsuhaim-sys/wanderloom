export const dynamic = 'force-dynamic';

import { DiscoverPageClient } from './DiscoverPageClient';

export const metadata = {
  title: 'اكتشف — فلسفة Wanderloom | Discover — Wanderloom',
  description:
    'ليست وكالة سفر، بل مصنع سيمفونيات سفر. Not a travel agency — a symphony factory for bespoke journeys.',
};

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}
