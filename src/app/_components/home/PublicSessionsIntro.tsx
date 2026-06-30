'use client';

import Link from 'next/link';

import { useLanguage } from '@/context/LanguageContext';

export function PublicSessionsIntro() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-black text-[#111111] sm:text-4xl">{t.sessions.title}</h1>
      <p className="mt-4 text-sm font-bold leading-relaxed text-gray-600 sm:text-base">
        {t.sessions.lead}
      </p>
      <p className="mt-3 text-xs font-bold text-gray-500">
        <Link href="/" className="font-black text-[#cda04c] underline underline-offset-4">
          ← الصفحة الرئيسية
        </Link>
      </p>
    </div>
  );
}
