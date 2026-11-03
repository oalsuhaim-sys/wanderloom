'use client';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Brand wordmark in the page language: «واندرلوم» on Arabic pages, WANDERLOOM on English pages.
 * Classic pairing «د»: El Messiri (Arabic) + Cormorant Garamond 700 (English). No letter-spacing in
 * Arabic (spacing breaks letter joining).
 */
export function Wordmark({ className = '', arClassName }: { className?: string; arClassName?: string }) {
  const { locale } = useLanguage();
  if (locale === 'ar') {
    // Arabic glyphs read smaller than Latin caps at the same size, so callers can pass a larger size.
    return <span className={`wl-wordmark wl-wordmark-ar leading-none ${arClassName ?? className}`}>واندرلوم</span>;
  }
  return <span className={`wl-wordmark leading-none ${className}`}>WANDERLOOM</span>;
}
