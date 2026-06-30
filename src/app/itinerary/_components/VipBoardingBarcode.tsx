'use client';

import { useMemo } from 'react';

import { barcodeWidthsFromSeed } from '@/lib/vip-boarding-barcode';

type Props = {
  seed: string;
  caption: string;
};

export default function VipBoardingBarcode({ seed, caption }: Props) {
  const widths = useMemo(() => barcodeWidthsFromSeed(seed), [seed]);

  return (
    <div className="border-t border-dashed border-[#D4AF37]/40 bg-white px-4 py-4 sm:px-6">
      <div
        className="mx-auto flex h-14 max-w-[280px] items-stretch justify-center gap-px overflow-hidden rounded-sm bg-white px-2"
        role="img"
        aria-label={`باركود الحجز ${caption}`}
      >
        {widths.map((w, i) => (
          <div
            key={`${seed}-${i}`}
            className="h-full shrink-0 bg-[#1E2720]"
            style={{ width: w }}
          />
        ))}
      </div>
      <p
        className="mt-2 text-center font-mono text-[11px] font-bold tracking-[0.35em] text-[#1E2720]/70"
        dir="ltr"
      >
        {caption}
      </p>
      <p className="mt-0.5 text-center text-[8px] font-bold uppercase tracking-widest text-[#1E2720]/30">
        PNR / Booking Reference
      </p>
    </div>
  );
}
