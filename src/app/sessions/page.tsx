export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { ar } from '@/messages/ar';
import { PublicSessionsCards } from '@/app/_components/home/PublicSessionsCards';
import { fetchPublicSessions } from '@/lib/fetch-public-sessions';

export const metadata = {
  title: 'الجلسات',
  description: 'جلسات Wanderloom المتاحة للتسجيل.',
};

export default async function PublicSessionsPage() {
  const { sessions, error, demo } = await fetchPublicSessions();

  return (
    <div className="min-h-screen bg-[#050c0a] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-white antialiased">
      <PublicNavbar />
      <main className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[length:min(88vw,640px)] bg-center bg-no-repeat opacity-[0.045]"
          style={{ backgroundImage: "url('/wanderloom_logo_hq.jpg')" }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-black sm:text-4xl">الجلسات المتاحة</h1>
            <p className="mt-4 text-sm font-bold text-white/50 sm:text-base">
              اختر جلسة ثم اضغط «سجّل الآن» لإرسال اسمك ورقم الواتساب — أو ارجع إلى{' '}
              <Link href="/" className="font-black text-[#d4b87a] underline underline-offset-4">
                الصفحة الرئيسية
              </Link>
              .
            </p>
          </div>
          <div className="mt-14">
            <PublicSessionsCards sessions={sessions} loadError={error} demo={demo} />
          </div>
        </div>
      </main>
      <footer className="border-t border-white/10 bg-[#030806] py-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <a
            href={`mailto:${ar.home.contactEmailAddress}?subject=${encodeURIComponent('استفسار — Wanderloom')}`}
            className="text-[11px] font-bold text-[#c9a84c]/70 underline decoration-[#c9a84c]/35 underline-offset-4 hover:text-[#d4b87a]"
          >
            {ar.home.contactEmailAddress}
          </a>
          <Link href="/#lead" className="text-xs font-black text-[#c9a84c]/60 hover:text-[#d4b87a]">
            نموذج سجّل رحلتك ←
          </Link>
        </div>
      </footer>
    </div>
  );
}
