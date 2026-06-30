'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';

export function PublicHomeHero() {
  const { t } = useLanguage();
  const hero = t.hero;

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 md:py-32 lg:py-40">
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#f4efe6]/60 via-transparent to-transparent"
        aria-hidden
      />
      <div className="relative w-full text-center">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cda04c]/30 bg-[#cda04c]/10 px-4 py-1.5 text-[11px] font-black tracking-wide text-[#9a7b45] sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {hero.badge}
        </p>
        <h1 className="mx-auto mb-5 max-w-4xl text-3xl font-black leading-[1.15] tracking-tight text-[#111111] sm:mb-6 sm:text-4xl md:text-6xl">
          {hero.titleLine1}
        </h1>
        <p className="mx-auto mb-6 max-w-2xl text-base font-bold leading-[1.9] text-gray-600 sm:text-lg">
          {hero.subtitle}
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <Link
            href="/sessions"
            className="inline-flex items-center justify-center rounded-2xl bg-[#cda04c] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#cda04c]/20 transition hover:bg-[#b3893d] sm:px-8"
          >
            {hero.ctaSessions}
          </Link>
          <a
            href="/#lead"
            className="inline-flex items-center justify-center rounded-2xl bg-[#1e3f20] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#1e3f20]/15 transition hover:bg-[#163018] sm:px-8"
          >
            {hero.ctaLead}
          </a>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center rounded-2xl border border-[#1e3f20] bg-[#1e3f20] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#163018] sm:px-6"
          >
            {hero.ctaPortal}
          </Link>
        </div>
      </div>
    </div>
  );
}
