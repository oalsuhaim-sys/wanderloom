export const dynamic = 'force-dynamic';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { PublicSessionsIntro } from '@/app/_components/home/PublicSessionsIntro';
import { LogoWatermarkLayer } from '@/app/_components/home/LogoWatermarkLayer';
import { PublicSessionsCards } from '@/app/_components/home/PublicSessionsCards';
import { fetchPublicSessions } from '@/lib/fetch-public-sessions';

import { SessionsFooter } from './SessionsFooter';

export const metadata = {
  title: 'الجلسات | Sessions',
  description: 'جلسات واندرلوم المتاحة للتسجيل · Wanderloom sessions open for registration.',
};

export default async function PublicSessionsPage() {
  const { sessions, error, demo } = await fetchPublicSessions();

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111] antialiased">
      <PublicNavbar />
      <main className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <LogoWatermarkLayer />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <PublicSessionsIntro />
          <div className="mt-14">
            <PublicSessionsCards sessions={sessions} loadError={error} demo={demo} />
          </div>
        </div>
      </main>
      <footer className="border-t border-[#1e3f20]/10 bg-[#f4efe6] py-10 text-center">
        <SessionsFooter />
      </footer>
    </div>
  );
}
