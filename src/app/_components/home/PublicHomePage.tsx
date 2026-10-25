'use client';

import type { ReactNode } from 'react';

import type { Session } from '@/types/session-tables';
import { useLanguage } from '@/context/LanguageContext';

import WanderloomQuiz from '@/components/WanderloomQuiz';
import DestinationAdvisor from '@/components/DestinationAdvisor';
import { AiConciergeWidget } from '@/components/AiConciergeWidget';

import { AffiliateReferralCapture } from './AffiliateReferralCapture';
import { GeneralContactSection } from './GeneralContactSection';
import { GroupTripsSection } from './GroupTripsSection';
import { LogoWatermarkLayer } from './LogoWatermarkLayer';
import { PublicAboutSection } from './PublicAboutSection';
import { PublicHomeHero } from './PublicHomeHero';
import { PublicNavbar } from './PublicNavbar';
import { PublicSessionsCards } from './PublicSessionsCards';
import { ScrollToLeadOnMount } from './ScrollToLeadOnMount';
import { TripDesignForm } from './TripDesignForm';
import { LoomDestinations } from './loom/LoomDestinations';
import { LoomFooter } from './loom/LoomFooter';
import { LoomProcess } from './loom/LoomProcess';
import { MobileStickyCta } from './loom/MobileStickyCta';

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
    <main className="wl-weave relative min-h-screen font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-[#1C2E3A] antialiased">
      <LogoWatermarkLayer />
      <AffiliateReferralCapture />
      <ScrollToLeadOnMount />
      <div className="relative z-10">
        <PublicNavbar />

        <SectionFrame id="top" className="wl-weave">
          <PublicHomeHero />
        </SectionFrame>

        <SectionFrame id="destinations" className="border-t border-[#9C7A3C]/20 bg-white/45 py-16 sm:py-20 md:py-24">
          <LoomDestinations />
        </SectionFrame>

        <SectionFrame id="advisor" className="border-t border-[#9C7A3C]/20 py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <DestinationAdvisor />
          </div>
        </SectionFrame>

        <SectionFrame
          id="quiz"
          clipOverflow={false}
          className="border-t border-[#9C7A3C]/20 bg-white/45 py-16 sm:py-20 md:py-24"
        >
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <WanderloomQuiz />
          </div>
        </SectionFrame>

        <SectionFrame id="weave" className="border-t border-[#9C7A3C]/20 py-16 sm:py-20 md:py-24">
          <LoomProcess />
        </SectionFrame>

        <SectionFrame id="about">
          <PublicAboutSection />
        </SectionFrame>

        <SectionFrame id="groups" className="py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">{t.loom.groupsKicker}</p>
              <h2 className="mt-3 text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl lg:text-[44px]">
                {t.groups.title}
              </h2>
              <p className="mt-4 text-base font-medium leading-loose text-[#3E4F5A] sm:text-[17px]">
                {t.groups.body}
              </p>
            </div>
            <GroupTripsSection />
          </div>
        </SectionFrame>

        <SectionFrame id="sessions" className="border-t border-[#9C7A3C]/20 bg-white/45 py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-6xl space-y-8 px-4 sm:space-y-12 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[28px] font-black leading-tight text-[#1C2E3A] sm:text-4xl">
                {t.sessions.title}
              </h2>
              <p className="mt-4 text-base font-medium leading-loose text-[#3E4F5A] sm:text-[17px]">
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

        <SectionFrame id="lead" className="border-t border-[#9C7A3C]/20 py-16 sm:py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-extrabold tracking-wide text-[#9C7A3C] sm:text-[13px]">{t.lead.title}</p>
              <h2 className="mt-3 text-[30px] font-black leading-tight text-[#1C2E3A] sm:text-4xl md:text-5xl">
                {t.loom.leadTitle}
              </h2>
              <p className="mt-4 text-base font-medium leading-loose text-[#3E4F5A] sm:text-[17px]">
                {t.loom.leadBody}
              </p>
            </div>
            <div className="mt-10 sm:mt-12">
              <TripDesignForm />
            </div>
          </div>
        </SectionFrame>

        <SectionFrame id="contact" className="border-t border-[#9C7A3C]/20 bg-white/40 py-20 sm:py-24 md:py-28">
          <GeneralContactSection />
        </SectionFrame>

        <LoomFooter />
      </div>
      <MobileStickyCta />
      <AiConciergeWidget />
    </main>
  );
}
