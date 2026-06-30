'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';

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
    <header className="sticky top-0 z-50 border-b border-[#1e3f20]/10 bg-[#FDFBF7]/95 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4">
        <Link
          href="/#top"
          className="text-xl font-black tracking-[0.14em] text-[#cda04c] sm:text-2xl sm:tracking-[0.18em] lg:text-3xl"
          style={{ fontFamily: 'inherit' }}
        >
          {t.brand.name}
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <nav className="flex items-center gap-0.5">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2.5 text-[13px] font-bold text-gray-700 transition hover:bg-[#f4efe6] hover:text-[#1e3f20]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full border border-[#1e3f20] px-3 py-1 text-sm font-bold text-[#1e3f20] transition hover:bg-[#f4efe6]"
          >
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full border border-[#1e3f20] px-3 py-1 text-sm font-bold text-[#1e3f20] transition hover:bg-[#f4efe6]"
          >
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-[#1e3f20]/20 bg-white p-2.5 text-[#1e3f20]"
            aria-expanded={open}
            aria-label={n.menuAria}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[#1e3f20]/10 bg-[#FDFBF7] px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-4 py-3.5 text-sm font-bold text-gray-800 hover:bg-[#f4efe6]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
