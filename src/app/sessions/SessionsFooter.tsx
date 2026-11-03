'use client';

import Link from 'next/link';

import { useLanguage } from '@/context/LanguageContext';
import { WANDERLOOM_CONTACT_EMAIL } from '@/lib/contact-email';

/** Sessions page footer in the page language. */
export function SessionsFooter() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={`mailto:${WANDERLOOM_CONTACT_EMAIL}?subject=${encodeURIComponent(t.footer.emailSubject)}`}
        className="text-[11px] font-bold text-[#9a7b45] underline decoration-[#cda04c]/40 underline-offset-4 hover:text-[#cda04c]"
      >
        {WANDERLOOM_CONTACT_EMAIL}
      </a>
      <Link href="/#lead" className="text-xs font-black text-[#cda04c]/80 hover:text-[#cda04c]">
        {t.ui.tripFormLink}
      </Link>
    </div>
  );
}
