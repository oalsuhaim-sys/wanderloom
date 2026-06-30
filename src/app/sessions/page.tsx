export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { PublicSessionsIntro } from '@/app/_components/home/PublicSessionsIntro';
import { LogoWatermarkLayer } from '@/app/_components/home/LogoWatermarkLayer';
import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';
import { PublicSessionsCards } from '@/app/_components/home/PublicSessionsCards';
import { fetchPublicSessions } from '@/lib/fetch-public-sessions';

export const metadata = {
  title: 'الجلسات',
  description: 'جلسات Wanderloom المتاحة للتسجيل.',
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
        <div className="flex flex-col items-center gap-3">
          <a
            href={`mailto:${WANDERLOOM_CONTACT_EMAIL}?subject=${encodeURIComponent('استفسار — Wanderloom')}`}
            className="text-[11px] font-bold text-[#9a7b45] underline decoration-[#cda04c]/40 underline-offset-4 hover:text-[#cda04c]"
          >
            {WANDERLOOM_CONTACT_EMAIL}
          </a>
          <Link href="/#lead" className="text-xs font-black text-[#cda04c]/80 hover:text-[#cda04c]">
            نموذج سجّل رحلتك ←
          </Link>
        </div>
      </footer>
    </div>
  );
}
