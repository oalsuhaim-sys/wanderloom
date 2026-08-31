'use client';

import type { ReactNode } from 'react';

import type { Session } from '@/types/session-tables';
import { useLanguage } from '@/context/LanguageContext';

import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';
import WanderloomQuiz from '@/components/WanderloomQuiz';
import DestinationAdvisor from '@/components/DestinationAdvisor';

import { AffiliateReferralCapture } from './AffiliateReferralCapture';
import { GeneralContactSection } from './GeneralContactSection';
import { GroupTripsSection } from './GroupTripsSection';
import { InterestFooterCta } from './InterestFooterCta';
import { LogoWatermarkLayer } from './LogoWatermarkLayer';
import { PublicAboutSection } from './PublicAboutSection';
import { PublicHomeHero } from './PublicHomeHero';
import { PublicNavbar } from './PublicNavbar';
import { PublicSessionsCards } from './PublicSessionsCards';
import { ScrollToLeadOnMount } from './ScrollToLeadOnMount';
import { TripDesignForm } from './TripDesignForm';

type PublicHomePageProps = {
  sessions: Session[];
  sessionsLoadError: string | null;
  sessionsDemo: boolean;
};

function SectionFrame({
  id,
  className,
  clipOverflow = true,
  children,
}: {
  id?: string;
  className?: string;
  clipOverflow?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative z-10 scroll-mt-28 bg-transparent ${clipOverflow ? 'overflow-hidden' : ''} ${className ?? ''}`}
    >
      {children}
    </section>
  );
}

export function PublicHomePage({ sessions, sessionsLoadError, sessionsDemo }: PublicHomePageProps) {
  const { t } = useLanguage();

  return (
    <main className="relative min-h-screen bg-[#F9F9F6] font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#111111] antialiased">
      <LogoWatermarkLayer />
      <AffiliateReferralCapture />
      <ScrollToLeadOnMount />
      <div className="relative z-10">
        <PublicNavbar />

        <SectionFrame id="top" className="border-b border-[#1e3f20]/10">
          <PublicHomeHero />
        </SectionFrame>

        <SectionFrame id="about" className="border-b border-[#1e3f20]/10 text-[#1A3B2A]">
          <PublicAboutSection />
        </SectionFrame>

        <SectionFrame id="advisor" className="border-b border-[#1e3f20]/10 py-12 sm:py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <DestinationAdvisor />
          </div>
        </SectionFrame>

        <SectionFrame
          id="quiz"
          clipOverflow={false}
          className="my-10 border-b border-[#1e3f20]/10 py-12 sm:my-16 sm:py-20 md:py-28"
        >
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <WanderloomQuiz />
          </div>
        </SectionFrame>

        <SectionFrame
          id="sessions"
          className="my-10 border-b border-[#1e3f20]/10 py-16 sm:my-16 sm:py-24 md:py-32"
        >
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-black text-[#111111] sm:text-3xl md:text-4xl">
                {t.sessions.title}
              </h2>
              <p className="mt-3 text-sm font-bold leading-relaxed text-gray-600 sm:mt-4 sm:text-base">
                {t.sessions.lead}
              </p>
            </div>

            <PublicSessionsCards
              sessions={sessions}
              loadError={sessionsLoadError}
              demo={sessionsDemo}
            />
          </div>
        </SectionFrame>

        <SectionFrame
          id="groups"
          className="my-10 border-b border-[#1e3f20]/10 py-16 sm:my-16 sm:py-24 md:py-32"
        >
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-black text-[#111111] sm:text-3xl md:text-4xl">
                {t.groups.title}
              </h2>
              <p className="mt-4 text-sm font-bold leading-relaxed text-gray-600 sm:mt-6 sm:text-base">
                {t.groups.body}
              </p>
            </div>
            <GroupTripsSection />
          </div>
        </SectionFrame>

        <SectionFrame id="contact" className="border-b border-[#1e3f20]/10 py-16 sm:py-24 md:py-32">
          <GeneralContactSection />
        </SectionFrame>

        <SectionFrame id="lead" className="py-16 sm:py-24 md:py-32">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-black text-[#111111] sm:text-3xl md:text-4xl">
                {t.lead.title}
              </h2>
              <p className="mt-3 text-sm font-bold leading-relaxed text-gray-600 sm:mt-4 sm:text-base">
                {t.lead.body}
              </p>
            </div>
            <div className="mt-10 sm:mt-14">
              <TripDesignForm />
            </div>
          </div>
        </SectionFrame>

        <footer className="border-t border-[#1e3f20]/10 bg-transparent px-4 py-10 text-center sm:py-12">
          <InterestFooterCta />
          <p className="text-xs font-black tracking-[0.4em] text-[#cda04c]/80">{t.footer.brand}</p>
          <p className="mt-2 text-[11px] font-bold text-gray-500">{t.footer.tagline}</p>
          <p className="mt-5">
            <a
              href={`mailto:${WANDERLOOM_CONTACT_EMAIL}?subject=${encodeURIComponent(t.footer.emailSubject)}`}
              className="text-[11px] font-bold text-[#9a7b45] underline decoration-[#cda04c]/40 underline-offset-4 transition hover:text-[#cda04c]"
            >
              {WANDERLOOM_CONTACT_EMAIL}
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
