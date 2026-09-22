'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Official brand logo as a scroll-driven background watermark.
 * Uses `/wanderloom.png` — the only official logo asset in public/.
 */
export function LogoWatermarkLayer() {
  const { scrollYProgress } = useScroll();

  const yTranslate = useTransform(scrollYProgress, [0, 1], ['0%', '-15%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.8, 1], [0.12, 0.08, 0.1, 0.05]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.05, 0.98]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 flex select-none items-center justify-center overflow-hidden pt-24 sm:pt-32"
    >
      <motion.div
        style={{ y: yTranslate, opacity, scale }}
        className="mt-12 h-auto w-[220px] sm:w-[300px] md:w-[420px] lg:w-[500px]"
      >
        <Image
          src="/wanderloom.png"
          alt=""
          width={500}
          height={200}
          priority
          className="h-auto w-full object-contain brightness-95 mix-blend-multiply"
        />
      </motion.div>
    </div>
  );
}

/** Alias matching the Claude / design brief name */
export default function DynamicBackgroundLogo() {
  return <LogoWatermarkLayer />;
}
