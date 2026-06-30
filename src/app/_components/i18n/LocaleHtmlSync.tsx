'use client';

import { useEffect } from 'react';

import { useLanguage } from '@/context/LanguageContext';

/** يزامن lang و dir على عنصر html مع اللغة النشطة */
export function LocaleHtmlSync() {
  const { locale } = useLanguage();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  return null;
}
