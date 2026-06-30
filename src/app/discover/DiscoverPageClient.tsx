'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { useLanguage } from '@/context/LanguageContext';
import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';

export function DiscoverPageClient() {
  const { t, dir } = useLanguage();
  const p = t.aboutPage;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111] antialiased">
      <PublicNavbar />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(205,160,76,0.08),transparent_50%),radial-gradient(ellipse_at_80%_60%,rgba(30,63,32,0.06),transparent_45%)]"
      />

      <main className="relative">
        <section className="relative overflow-hidden border-b border-[#1e3f20]/10">
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#f4efe6]/70 via-transparent to-transparent"
            aria-hidden
          />
          <div className="relative z-10 mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-xs font-black text-[#1e3f20] transition hover:text-[#163018]"
            >
              <ArrowLeft
                className={`h-4 w-4 ${dir === 'ltr' ? 'rotate-180' : ''}`}
                aria-hidden
              />
              {p.backToHome}
            </Link>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#cda04c]/30 bg-[#cda04c]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#9a7b45] sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {p.discoverBadge}
            </p>
            <h1 className="mt-8 text-[2rem] font-black leading-[1.15] tracking-tight text-[#111111] sm:text-5xl lg:text-[3.5rem]">
              {p.titleLine1}
              <span
                className={`mt-4 block bg-clip-text text-transparent ${
                  dir === 'rtl'
                    ? 'bg-gradient-to-l from-[#1e3f20] via-[#cda04c] to-[#d4b87a]'
                    : 'bg-gradient-to-r from-[#1e3f20] via-[#cda04c] to-[#d4b87a]'
                }`}
              >
                {p.titleLine2}
              </span>
            </h1>
            <p className="mt-10 max-w-2xl text-base font-bold leading-[1.95] text-gray-600 sm:text-lg">
              {p.description}
            </p>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link
                href="/#lead"
                className="inline-flex items-center justify-center rounded-2xl bg-[#1e3f20] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-[#1e3f20]/15 transition hover:bg-[#163018]"
              >
                {p.startDesignBtn}
              </Link>
              <Link
                href="/sessions"
                className="inline-flex items-center justify-center rounded-2xl bg-[#cda04c] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-[#cda04c]/20 transition hover:bg-[#b3893d]"
              >
                {p.browseSessionsBtn}
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-[#1e3f20]/10 bg-[#f9f6f0] py-20 sm:py-28">
          <div className="mx-auto max-w-3xl space-y-16 px-5 sm:px-8">
            <article className="rounded-[2rem] border border-[#1e3f20]/10 bg-white p-8 shadow-lg shadow-[#1e3f20]/5 sm:p-10">
              <h2 className="text-xl font-black text-[#1e3f20] sm:text-2xl">{p.sectionModelTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-gray-600 sm:text-base">
                {p.sectionModelBody}
              </p>
            </article>
            <article className="rounded-[2rem] border border-[#cda04c]/20 bg-white p-8 shadow-lg shadow-[#cda04c]/5 sm:p-10">
              <h2 className="text-xl font-black text-[#9a7b45] sm:text-2xl">{p.sectionPhilosophyTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-gray-600 sm:text-base">
                {p.sectionPhilosophyBody}
              </p>
            </article>
            <article className="rounded-[2rem] border border-[#1e3f20]/10 bg-[#FDFBF7] p-8 sm:p-10">
              <h2 className="text-xl font-black text-[#111111] sm:text-2xl">{p.sectionYouTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-gray-600 sm:text-base">
                {p.sectionYouBody}
              </p>
            </article>
          </div>
        </section>

        <section className="bg-[#FDFBF7] py-16 text-center text-[#14221c]">
          <p className="text-xs font-black tracking-[0.35em] text-[#1e3f20]/80">{t.brand.name}</p>
          <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed text-gray-600">
            {p.brandTagline}
          </p>
          <Link
            href="/#lead"
            className="mt-8 inline-flex rounded-2xl bg-[#1e3f20] px-10 py-4 text-sm font-black text-white shadow-lg shadow-[#1e3f20]/15 transition hover:bg-[#163018]"
          >
            {p.startDesignBtn}
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#1e3f20]/10 bg-[#f4efe6] py-10 text-center">
        <p className="text-xs font-black tracking-[0.4em] text-[#cda04c]/80">{t.footer.brand}</p>
        <p className="mt-4">
          <a
            href={`mailto:${WANDERLOOM_CONTACT_EMAIL}?subject=${encodeURIComponent(t.footer.emailSubject)}`}
            className="text-[11px] font-bold text-[#1e3f20] underline decoration-[#1e3f20]/30 underline-offset-4 hover:text-[#163018]"
          >
            {WANDERLOOM_CONTACT_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  );
}
