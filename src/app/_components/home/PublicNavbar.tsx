'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Public landing navbar — Phase 1 glassmorphism (forced via `.wl-public-navbar` CSS).
 * Backup: `PublicNavbar_old.tsx`
 */
export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const { locale, t, toggleLanguage } = useLanguage();
  const n = t.nav;

  const links = useMemo(
    () =>
      [
        { href: '/#top', label: n.home },
        { href: '/#about', label: n.about },
        { href: '/discover', label: n.discover },
        { href: '/sessions', label: n.sessions },
        { href: '/#lead', label: n.lead },
        { href: '/portal', label: n.portal },
      ] as const,
    [n],
  );

  return (
    <header
      data-wl-nav="phase1-glass"
      className="wl-public-navbar sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4">
        <Link
          href="/#top"
          className="wl-public-nav-logo text-xl font-black tracking-[0.14em] text-[#C5A059] transition-colors duration-300 hover:text-[#A88849] sm:text-2xl sm:tracking-[0.18em] lg:text-3xl"
        >
          {t.brand.name}
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <nav className="flex items-center gap-0.5">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="wl-public-nav-link group relative rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors duration-300"
              >
                {item.label}
                <span
                  className="wl-public-nav-underline pointer-events-none absolute inset-x-4 -bottom-0.5 h-px origin-center scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden
                />
              </Link>
            ))}
            <Link
              href="/join-partner"
              className="wl-public-nav-partner rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-300"
            >
              انضم كشريك
            </Link>
          </nav>
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full border border-stone-300 px-3 py-1 text-sm font-bold text-stone-800 transition-colors duration-300 hover:border-amber-400 hover:text-amber-700"
          >
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full border border-stone-300 px-3 py-1 text-sm font-bold text-stone-800 transition-colors duration-300 hover:border-amber-400 hover:text-amber-700"
          >
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-stone-200 bg-white/70 p-2.5 text-stone-800 transition-colors duration-300 hover:border-amber-400 hover:text-amber-700"
            aria-expanded={open}
            aria-label={n.menuAria}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-stone-200/80 bg-white/95 px-5 py-5 backdrop-blur-md lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="wl-public-nav-link rounded-xl px-4 py-3.5 text-sm font-bold transition-colors duration-300 hover:bg-amber-50"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/join-partner"
              className="wl-public-nav-partner mt-1 rounded-full border px-4 py-1.5 text-center text-sm font-medium transition-colors duration-300"
              onClick={() => setOpen(false)}
            >
              انضم كشريك
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
