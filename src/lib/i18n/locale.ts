export type Locale = 'ar' | 'en';

export const LOCALE_STORAGE_KEY = 'wanderloom-locale';

export const defaultLocale: Locale = 'ar';

export const locales: Locale[] = ['ar', 'en'];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'ar' || value === 'en';
}

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function localeLabel(locale: Locale): string {
  return locale === 'ar' ? 'العربية' : 'English';
}
