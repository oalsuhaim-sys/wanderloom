import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { LoomFooter } from '@/app/_components/home/loom/LoomFooter';

import { TailorPlanView } from '../_components/TailorPlanView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'خطتك | فصّل الآن',
  robots: { index: false, follow: false },
};

export default async function TailorPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="wl-weave min-h-screen font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111] antialiased print:bg-white">
      <div className="print:hidden">
        <PublicNavbar />
      </div>
      <main className="relative">
        <TailorPlanView token={token} />
      </main>
      <div className="print:hidden">
        <LoomFooter />
      </div>
    </div>
  );
}
