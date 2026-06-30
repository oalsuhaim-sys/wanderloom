'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n/locale';

const OPTIONS: { id: Locale; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="flex items-center rounded-full border border-[#c9a84c]/25 bg-black/30 p-0.5 backdrop-blur-md"
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((option) => {
        const active = locale === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLocale(option.id)}
            className={`min-w-[2.25rem] rounded-full px-2.5 py-1.5 text-[11px] font-black tracking-wide transition ${
              active
                ? 'bg-gradient-to-b from-[#d4b87a] to-[#9a7b45] text-[#0a1814] shadow-sm'
                : 'text-white/55 hover:text-[#e8d5a8]'
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
