import { Suspense } from 'react';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { LoomFooter } from '@/app/_components/home/loom/LoomFooter';

import { TailorNowWizard } from './_components/TailorNowWizard';

export const metadata = {
  title: 'فصّل الآن | واندرلوم',
  description: 'رحلتك يوماً بيوم، جاهزة خلال دقائق — اليوم الأول عليك.',
};

export default function TailorNowPage() {
  return (
    <div className="wl-weave min-h-screen font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111] antialiased">
      <PublicNavbar />
      <main className="relative">
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <TailorNowWizard />
        </Suspense>
      </main>
      <LoomFooter />
    </div>
  );
}
