/**
 * @deprecated Prefer `LanguageProvider` / `useLanguage` from `@/context/LanguageContext`.
 * Thin re-export shim so existing imports keep working during migration.
 */
export {
  LanguageProvider as LocaleProvider,
  useLanguage as useLocale,
  type Locale,
  type Dictionary as AppMessages,
} from '@/context/LanguageContext';
