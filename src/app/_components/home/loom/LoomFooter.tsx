'use client';

import Link from 'next/link';

import { useLanguage } from '@/context/LanguageContext';
import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';

import { InterestFooterCta } from '../InterestFooterCta';
import { BrandMark } from './BrandMark';

/** Navy woven footer — mark, slogan, links, contact. */
export function LoomFooter() {
  const { t } = useLanguage();
  const l = t.loom;
  const n = t.nav;

  return (
    <footer className="wl-weave-dark relative z-10 px-4 pb-24 pt-14 text-[#F4EFE6] sm:px-8 sm:pb-10 sm:pt-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-start">
          <div className="flex max-w-md flex-col gap-3">
            <span className="inline-flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4EFE6]">
                <BrandMark size={42} showWordmark={false} />
              </span>
              <span className="wl-wordmark text-2xl sm:text-[28px]">WANDERLOOM</span>
            </span>
            <p className="text-xl font-black text-[#D9B238]">{l.footerSlogan}</p>
            <p className="text-sm text-[#C9D1D6]">{l.footerTagline}</p>
          </div>

          <nav aria-label={n.menuAria} className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-bold">
            <Link href="/#about" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.about}</Link>
            <Link href="/discover" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.discover}</Link>
            <Link href="/sessions" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.sessions}</Link>
            <Link href="/#lead" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.lead}</Link>
            <Link href="/portal" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.portal}</Link>
            <Link href="/#contact" className="text-[#F4EFE6] transition hover:text-[#D9B238]">{n.contact}</Link>
          </nav>

          <div className="w-full max-w-sm text-[#1C2E3A] lg:w-auto">
            <InterestFooterCta />
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-4 border-t border-dashed border-[#D9B238]/45 pt-5 text-[13px] text-[#C9D1D6]">
          <a
            href={`mailto:${WANDERLOOM_CONTACT_EMAIL}?subject=${encodeURIComponent(t.footer.emailSubject)}`}
            dir="ltr"
            className="transition hover:text-[#D9B238]"
          >
            {WANDERLOOM_CONTACT_EMAIL}
          </a>
          <span>
            © Wanderloom · {l.footerCity}
          </span>
        </div>
      </div>
    </footer>
  );
}
