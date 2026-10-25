'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import { useLanguage } from '@/context/LanguageContext';

/**
 * «من نحن» — navy woven band (loom redesign) with the brand manifesto.
 */
export function PublicAboutSection() {
  const { t } = useLanguage();

  return (
    <div data-wl-about="loom" className="wl-weave-dark relative px-4 py-20 text-[#F4EFE6] sm:px-8 sm:py-24 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="mx-auto flex max-w-4xl flex-col items-center gap-7 text-center"
      >
        <p className="text-xs font-extrabold tracking-[0.2em] text-[#D9B238] sm:text-[13px]">{t.about.kicker}</p>
        <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden>
          <path
            d="M26 4 C 12 6 4 16 4 30 L 4 36 L 22 36 L 22 22 L 12 22 C 12 14 18 10 26 10 Z M60 4 C 46 6 38 16 38 30 L 38 36 L 56 36 L 56 22 L 46 22 C 46 14 52 10 60 10 Z"
            fill="#D9B238"
          />
        </svg>
        <blockquote className="text-xl font-bold leading-[2] sm:text-2xl md:text-[30px] md:leading-[1.9]">{t.about.quote}</blockquote>
        <p className="inline-flex items-center gap-3.5 text-[#D9B238]" aria-hidden>
          <span className="inline-block h-px w-12 bg-[#D9B238]" />
          <span className="wl-wordmark text-lg sm:text-xl">WANDERLOOM</span>
          <span className="inline-block h-px w-12 bg-[#D9B238]" />
        </p>
        <Link
          href="/discover"
          className="wl-gold-cta inline-flex min-h-[52px] items-center justify-center rounded-full px-9 text-[15px] font-black"
        >
          {t.about.discoverMore}
        </Link>
      </motion.div>
    </div>
  );
}
