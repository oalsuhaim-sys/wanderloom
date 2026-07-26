'use client';

import { Moon, Sun } from 'lucide-react';

import { useCrmTheme } from './CrmThemeProvider';

type CrmThemeToggleProps = {
  className?: string;
  /** Compact icon button for sidebar / mobile header */
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
        className={`h-9 ${compact ? 'w-9' : 'w-full'} rounded-xl border border-white/10 bg-white/5 ${className}`}
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
          ? `inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-white/5 text-[#C5A059] transition hover:bg-white/10 ${className}`
          : `mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-right transition-colors duration-300 hover:border-[#C5A059]/40 hover:bg-white/10 ${className}`
      }
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن الفاخر'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن الفاخر'}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" aria-hidden />
      ) : (
        <Moon className="h-3.5 w-3.5 shrink-0 text-[#C5A059]" aria-hidden />
      )}
      {compact ? null : (
        <>
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-gray-300">
            {isDark ? 'الوضع الفاتح' : 'الوضع الداكن الفاخر'}
          </span>
          <span className="shrink-0 text-[9px] font-bold tracking-wide text-[#C5A059]/90">
            {isDark ? 'Light' : 'Dark'}
          </span>
        </>
      )}
    </button>
  );
}
