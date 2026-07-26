'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Public landing hero — Phase 1 CTAs (watermark is global/fixed on the page).
 */
export function PublicHomeHero() {
  const { t } = useLanguage();
  const hero = t.hero;

  return (
    <div
      data-wl-hero="phase1"
      className="relative mx-auto max-w-6xl bg-transparent px-4 py-16 sm:px-8 sm:py-24 md:py-32 lg:py-40"
    >
      <div className="relative z-10 w-full text-center">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50 px-4 py-1.5 text-[11px] font-black tracking-wide text-amber-800 sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {hero.badge}
        </p>
        <h1 className="mx-auto mb-6 max-w-4xl text-3xl font-black leading-snug tracking-tight text-stone-900 sm:mb-8 sm:text-4xl md:text-6xl md:leading-snug">
          {hero.titleLine1}
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-base font-bold leading-loose text-stone-600 sm:mb-10 sm:text-lg">
          {hero.subtitle}
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          <Link
            href="/sessions"
            className="wl-hero-cta wl-hero-cta--gold inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-black text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg sm:px-8"
          >
            {hero.ctaSessions}
          </Link>
          <a
            href="/#lead"
            className="wl-hero-cta wl-hero-cta--green inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-black text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg sm:px-8"
          >
            {hero.ctaLead}
          </a>
          <Link
            href="/portal"
            className="wl-hero-cta wl-hero-cta--green inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-black text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg sm:px-8"
          >
            {hero.ctaPortal}
          </Link>
        </div>
      </div>
    </div>
  );
}
