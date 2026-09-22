'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Editorial "About Us" — slow Framer Motion reveal (watermark is global/fixed on the page).
 */
export function PublicAboutSection() {
  const { t } = useLanguage();

  return (
    <div
      data-wl-about="phase3-dramatic"
      className="relative mx-auto max-w-3xl px-4 py-16 sm:px-8 sm:py-24 md:py-32"
    >
      <div className="relative z-10">
        <p className="text-center text-[10px] font-black tracking-[0.35em] text-[#9C7A3C] sm:text-xs">
          {t.about.kicker}
        </p>
        <h2 className="mt-5 text-center text-2xl font-black text-[#1C2E3A] sm:mt-6 sm:text-3xl md:text-4xl">
          {t.about.title}
        </h2>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        >
          <blockquote className="wl-about-manifesto mt-8 border-r-4 border-[#9C7A3C] pr-5 text-base font-bold leading-[2.5] text-[#1C2E3A]/90 sm:mt-12 sm:pr-7 sm:text-lg md:text-xl md:leading-[2.55]">
            {t.about.quote}
          </blockquote>

          <div className="mt-12 flex justify-center sm:mt-14">
            <Link
              href="/discover"
              className="wl-hero-cta wl-hero-cta--green inline-flex items-center justify-center rounded-full bg-[#1C2E3A] px-10 py-4 text-sm font-black text-[#F4EFE6] shadow-lg transition-all duration-500 hover:-translate-y-1 hover:bg-[#122029] hover:shadow-[0_10px_20px_rgba(28,46,58,0.2)]"
            >
              {t.about.discoverMore}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
