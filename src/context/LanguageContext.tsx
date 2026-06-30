'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

export type Locale = 'ar' | 'en';

export type Dictionary = typeof ar;

const STORAGE_KEY = 'wanderloom-locale';

const dictionaries: Record<Locale, Dictionary> = { ar, en };

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'ar' || value === 'en';
}

function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

type LanguageContextValue = {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dir: localeDirection(locale),
      t: dictionaries[locale],
      setLocale,
      toggleLanguage,
    }),
    [locale, setLocale, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      <div dir={hydrated ? value.dir : 'rtl'} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export { STORAGE_KEY as LANGUAGE_STORAGE_KEY };
