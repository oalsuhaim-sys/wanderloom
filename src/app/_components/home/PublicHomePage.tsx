import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import type { Session } from '@/types/session-tables';
import { ar } from '@/messages/ar';

import { GeneralContactSection } from './GeneralContactSection';
import { GroupTripsSection } from './GroupTripsSection';
import { PublicNavbar } from './PublicNavbar';
import { PublicSessionsCards } from './PublicSessionsCards';
import { ScrollToLeadOnMount } from './ScrollToLeadOnMount';
import { TripDesignForm } from './TripDesignForm';

type PublicHomePageProps = {
  sessions: Session[];
  sessionsLoadError: string | null;
  sessionsDemo: boolean;
};

function LogoWatermarkLayer() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[length:min(88vw,640px)] bg-center bg-no-repeat opacity-[0.045] sm:opacity-[0.06]"
        style={{ backgroundImage: "url('/wanderloom_logo_hq.jpg')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(28,69,50,0.12),transparent_55%)]"
      />
    </>
  );
}

function SectionFrame({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`relative scroll-mt-28 overflow-hidden ${className ?? ''}`}>
      <LogoWatermarkLayer />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function PublicHomePage({ sessions, sessionsLoadError, sessionsDemo }: PublicHomePageProps) {
  const h = ar.home;

  return (
    <div className="min-h-screen bg-[#050c0a] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-white antialiased">
      <ScrollToLeadOnMount />
      <PublicNavbar />

      {/* Hero */}
      <SectionFrame id="top" className="border-b border-white/[0.07]">
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32 lg:py-40">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a2218]/90 via-[#050c0a] to-[#050c0a]" aria-hidden />
          <div className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#c9a84c]/25 bg-[#c9a84c]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#e8d5a8] sm:text-xs">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {ar.brand.heroBadge}
              </p>
              <h1 className="mt-8 text-[2.1rem] font-black leading-[1.2] tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.15]">
                {h.heroTitleLine1}
                <span className="mt-3 block bg-gradient-to-l from-[#f0e4c4] via-[#d4b87a] to-[#9a7b45] bg-clip-text text-transparent">
                  {h.heroTitleLine2}
                </span>
              </h1>
              <p className="mt-8 max-w-xl text-base font-bold leading-[1.85] text-white/52 sm:text-lg">{h.heroLead}</p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/sessions"
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] px-8 py-3.5 text-sm font-black text-[#0a1814] shadow-lg shadow-black/30"
                >
                  {h.ctaSessions}
                </Link>
                <a
                  href="/#lead"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-black text-white/90 backdrop-blur-sm hover:bg-white/[0.07]"
                >
                  {h.ctaLead}
                </a>
                <Link
                  href="/portal"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#1c4532]/50 bg-[#1c4532]/35 px-6 py-3.5 text-sm font-black text-white/95 hover:bg-[#1c4532]/50"
                >
                  {h.ctaPortal}
                </Link>
              </div>
            </div>
            <div className="relative mx-auto aspect-[4/3] w-full max-w-lg lg:max-w-none">
              <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-[#c9a84c]/20 via-transparent to-[#1c4532]/30 blur-2xl" aria-hidden />
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-[2.25rem] ring-1 ring-[#c9a84c]/20 sm:min-h-[320px]">
                <Image
                  src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=88"
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050c0a] via-[#050c0a]/20 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </SectionFrame>

      {/* من نحن */}
      <SectionFrame id="about" className="border-b border-white/[0.07] bg-[#f4f1eb] text-[#14221c]">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
          <p className="text-center text-xs font-black tracking-[0.35em] text-[#6b5c38]">{h.aboutKicker}</p>
          <h2 className="mt-4 text-center text-3xl font-black text-[#0f1e16] sm:text-4xl">{h.aboutTitle}</h2>
          <blockquote className="mt-12 border-r-4 border-[#c9a84c]/70 pr-6 text-lg font-bold leading-[2.05] text-[#2d3a33] sm:text-xl">
            {h.aboutQuote}
          </blockquote>
          <div className="mt-12 flex justify-center">
            <Link
              href="/discover"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-[#1c4532]/25 bg-[#1c4532] px-10 py-4 text-sm font-black text-[#f0e4c4] shadow-[0_12px_40px_rgba(28,69,50,0.25)] transition hover:bg-[#163a30]"
            >
              {h.discoverMore}
            </Link>
          </div>
        </div>
      </SectionFrame>

      {/* الجلسات */}
      <SectionFrame id="sessions" className="border-b border-white/[0.07] bg-[#06120f] py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl">{h.sessionsTitle}</h2>
            <p className="mt-4 text-sm font-bold leading-relaxed text-white/48 sm:text-base">{h.sessionsLead}</p>
          </div>

          <div className="mt-14">
            <PublicSessionsCards
              sessions={sessions}
              loadError={sessionsLoadError}
              demo={sessionsDemo}
            />
          </div>
        </div>
      </SectionFrame>

      {/* المجموعات */}
      <SectionFrame id="groups" className="border-b border-white/[0.07] bg-[#eef0ec] py-24 text-[#14221c] sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black sm:text-4xl">{h.groupsTitle}</h2>
            <p className="mt-6 text-base font-bold leading-[1.9] text-[#3d4a42]">{h.groupsBody}</p>
          </div>
          <GroupTripsSection />
        </div>
      </SectionFrame>

      {/* تواصل عام */}
      <SectionFrame id="contact" className="border-b border-white/[0.07] bg-[#06120f] py-24 sm:py-32">
        <GeneralContactSection />
      </SectionFrame>

      {/* نموذج تصميم الرحلة */}
      <SectionFrame id="lead" className="bg-[#050c0a] py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl">{h.leadTitle}</h2>
            <p className="mt-4 text-sm font-bold leading-relaxed text-white/48 sm:text-base">{h.leadBody}</p>
          </div>
          <div className="mt-14">
            <TripDesignForm />
          </div>
        </div>
      </SectionFrame>

      <footer className="border-t border-white/10 bg-[#030806] py-12 text-center">
        <p className="text-xs font-black tracking-[0.4em] text-[#c9a84c]/45">{h.footerBrand}</p>
        <p className="mt-2 text-[11px] font-bold text-white/28">{h.footerTagline}</p>
        <p className="mt-5">
          <a
            href={`mailto:${h.contactEmailAddress}?subject=${encodeURIComponent('استفسار — Wanderloom')}`}
            className="text-[11px] font-bold text-[#c9a84c]/70 underline decoration-[#c9a84c]/35 underline-offset-4 transition hover:text-[#d4b87a]"
          >
            {h.contactEmailAddress}
          </a>
        </p>
      </footer>
    </div>
  );
}
