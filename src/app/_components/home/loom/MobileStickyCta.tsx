'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Phone-only bottom bar «جاهز تبدأ؟ سجّل رحلتك». Appears after the hero and hides
 * while the registration section is on screen, so it never covers the form.
 */
export function MobileStickyCta() {
  const { t } = useLanguage();
  const [pastHero, setPastHero] = useState(false);
  const [leadVisible, setLeadVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const lead = document.getElementById('lead');
    let io: IntersectionObserver | null = null;
    if (lead && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => setLeadVisible(entry?.isIntersecting ?? false), { threshold: 0.05 });
      io.observe(lead);
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      io?.disconnect();
    };
  }, []);

  const show = pastHero && !leadVisible;

  return (
    <div
      aria-hidden={!show}
      className={`fixed bottom-4 start-4 z-[70] transition-all duration-300 lg:hidden ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* start side — the AI concierge button owns the opposite corner */}
      <Link
        href="/#lead"
        tabIndex={show ? 0 : -1}
        aria-label={`${t.loom.stickyPrompt} ${t.loom.stickyCta}`}
        className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#D9B238] px-6 text-[15px] font-black text-[#1C2E3A] shadow-[0_0_0_4px_#1C2E3A,0_18px_36px_-14px_rgba(28,46,58,0.8)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3l2.4 5.6L20 9.3l-4.3 3.9 1.2 5.8L12 16.1 7.1 19l1.2-5.8L4 9.3l5.6-.7z" />
        </svg>
        {t.loom.stickyCta}
      </Link>
    </div>
  );
}
