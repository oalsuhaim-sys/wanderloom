'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { ar } from '@/messages/ar';

const n = ar.nav;

const LINKS = [
  { href: '/#top', label: n.home },
  { href: '/#about', label: n.about },
  { href: '/discover', label: n.discover },
  { href: '/sessions', label: n.sessions },
  { href: '/#lead', label: n.lead },
  { href: '/portal', label: n.portal },
] as const;

export function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      id="top"
      className="sticky top-0 z-50 border-b border-white/10 bg-[#06120f]/92 backdrop-blur-2xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          href="/#top"
          className="text-[15px] font-black tracking-[0.22em] text-[#d4b87a] sm:text-base"
          style={{ fontFamily: 'inherit' }}
        >
          {ar.brand.name}
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2.5 text-[13px] font-bold text-white/78 transition hover:bg-white/[0.06] hover:text-[#e8d5a8]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-xl border border-white/12 bg-white/[0.04] p-2.5 text-white lg:hidden"
          aria-expanded={open}
          aria-label={n.menuAria}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#050f0c] px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-4 py-3.5 text-sm font-bold text-white/90 hover:bg-white/[0.05]"
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
