/**
 * Translation layer — Arabic default + English.
 * Usage (client): `const { t } = useLanguage()` from `@/context/LanguageContext`
 * Usage (server): `getMessages('ar')` until server pages adopt locale cookies.
 */
import type { AppMessages } from './ar';
import { ar } from './ar';
import { en } from './en';

export type { AppMessages } from './ar';
export { ar, en };

export type { Locale } from '@/lib/i18n/locale';
export { defaultLocale, locales } from '@/lib/i18n/locale';

export function getMessages(locale: 'ar' | 'en'): AppMessages {
  return locale === 'en' ? en : ar;
}
