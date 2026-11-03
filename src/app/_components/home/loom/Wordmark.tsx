'use client';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Brand wordmark in the page language: «واندرلوم» on Arabic pages, WANDERLOOM on English pages.
 * Arabic uses Tajawal without letter-spacing (spacing breaks Arabic letter joining).
 */
export function Wordmark({ className = '' }: { className?: string }) {
  const { locale } = useLanguage();
  if (locale === 'ar') {
    return <span className={`wl-wordmark wl-wordmark-ar leading-none ${className}`}>واندرلوم</span>;
  }
  return <span className={`wl-wordmark leading-none ${className}`}>WANDERLOOM</span>;
}
