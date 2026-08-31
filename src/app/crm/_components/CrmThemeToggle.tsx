'use client';

import { Moon, Sun } from 'lucide-react';

import { useCrmTheme } from './CrmThemeProvider';

type CrmThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export default function CrmThemeToggle({
  className = '',
  compact = false,
}: CrmThemeToggleProps) {
  const { theme, toggleTheme, ready } = useCrmTheme();
  const isDark = theme === 'dark';

  if (!ready) {
    return (
      <div
        className={`h-9 ${compact ? 'w-9' : 'w-full'} rounded-lg border border-slate-200 bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#2A3834] ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        compact
          ? `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:text-[#D4AF37] dark:hover:border-[#D4AF37]/40 ${className}`
          : `mb-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-right transition-all duration-200 ease-in-out hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#2A3834] dark:hover:border-[#D4AF37]/30 ${className}`
      }
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
      ) : (
        <Moon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      )}
      {compact ? null : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600 dark:text-gray-300">
            {isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </span>
          <span className="shrink-0 text-[10px] font-medium tracking-wide text-slate-400 dark:text-[#D4AF37]/80">
            {isDark ? 'Light' : 'Dark'}
          </span>
        </>
      )}
    </button>
  );
}
