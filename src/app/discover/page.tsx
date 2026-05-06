export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { PublicNavbar } from '@/app/_components/home/PublicNavbar';
import { ar } from '@/messages/ar';

const d = ar.discover;
const h = ar.home;

export const metadata = {
  title: d.metaTitle,
  description: d.metaDescription,
};

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-[#050c0a] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-white antialiased">
      <PublicNavbar />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(201,168,76,0.14),transparent_50%),radial-gradient(ellipse_at_80%_60%,rgba(28,69,50,0.35),transparent_45%)]"
      />

      <main className="relative">
        <section className="relative overflow-hidden border-b border-white/[0.07]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a2218]/95 via-[#050c0a] to-[#050c0a]" aria-hidden />
          <div className="relative z-10 mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-xs font-black text-[#c9a84c]/80 transition hover:text-[#e8d5a8]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {d.backHome}
            </Link>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#c9a84c]/28 bg-[#c9a84c]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#e8d5a8] sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {d.kicker}
            </p>
            <h1 className="mt-8 text-[2rem] font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              {d.heroTitle}
              <span className="mt-4 block bg-gradient-to-l from-[#f0e4c4] via-[#d4b87a] to-[#7a5f28] bg-clip-text text-transparent">
                {d.heroHighlight}
              </span>
            </h1>
            <p className="mt-10 max-w-2xl text-base font-bold leading-[1.95] text-white/55 sm:text-lg">{d.heroLead}</p>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link
                href="/#lead"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] px-8 py-3.5 text-sm font-black text-[#0a1814] shadow-lg shadow-black/30"
              >
                {d.ctaLead}
              </Link>
              <Link
                href="/sessions"
                className="inline-flex items-center justify-center rounded-2xl border border-[#1c4532]/55 bg-[#1c4532]/35 px-8 py-3.5 text-sm font-black text-[#f0e4c4] hover:bg-[#1c4532]/50"
              >
                {d.ctaSessions}
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.07] bg-[#06120f] py-20 sm:py-28">
          <div className="mx-auto max-w-3xl space-y-16 px-5 sm:px-8">
            <article className="rounded-[2rem] border border-[#c9a84c]/20 bg-gradient-to-b from-white/[0.06] to-transparent p-8 shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:p-10">
              <h2 className="text-xl font-black text-[#e8d5a8] sm:text-2xl">{d.sectionModelTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-white/60 sm:text-base">{d.sectionModelBody}</p>
            </article>
            <article className="rounded-[2rem] border border-[#1c4532]/35 bg-[#071612]/90 p-8 sm:p-10">
              <h2 className="text-xl font-black text-[#d4b87a] sm:text-2xl">{d.sectionPhilosophyTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-white/58 sm:text-base">{d.sectionPhilosophyBody}</p>
            </article>
            <article className="rounded-[2rem] border border-[#c9a84c]/25 bg-[#0a1814]/80 p-8 sm:p-10">
              <h2 className="text-xl font-black text-[#e8d5a8] sm:text-2xl">{d.sectionYouTitle}</h2>
              <p className="mt-5 text-sm font-bold leading-[1.95] text-white/58 sm:text-base">{d.sectionYouBody}</p>
            </article>
          </div>
        </section>

        <section className="bg-[#f4f1eb] py-16 text-center text-[#14221c]">
          <p className="text-xs font-black tracking-[0.35em] text-[#6b5c38]">{ar.brand.name}</p>
          <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed text-[#3d4a42]">{ar.brand.tagline}</p>
          <Link
            href="/#lead"
            className="mt-8 inline-flex rounded-2xl bg-[#1c4532] px-10 py-4 text-sm font-black text-[#f0e4c4] shadow-lg transition hover:bg-[#163a30]"
          >
            {d.ctaLead}
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#030806] py-10 text-center">
        <p className="text-xs font-black tracking-[0.4em] text-[#c9a84c]/45">WANDERLOOM</p>
        <p className="mt-4">
          <a
            href={`mailto:${h.contactEmailAddress}?subject=${encodeURIComponent('استفسار — Wanderloom')}`}
            className="text-[11px] font-bold text-[#c9a84c]/70 underline decoration-[#c9a84c]/35 underline-offset-4 hover:text-[#d4b87a]"
          >
            {h.contactEmailAddress}
          </a>
        </p>
      </footer>
    </div>
  );
}
