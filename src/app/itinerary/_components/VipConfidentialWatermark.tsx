'use client';

const WATERMARK_TEXT = 'WANDERLOOM CONFIDENTIAL';
const WATERMARK_TILES = 48;

export default function VipConfidentialWatermark() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden
    >
      <div className="absolute left-1/2 top-1/2 flex w-[220vmax] -translate-x-1/2 -translate-y-1/2 -rotate-45 flex-wrap items-center justify-center gap-x-16 gap-y-12">
        {Array.from({ length: WATERMARK_TILES }, (_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.35em] text-white/[0.04] sm:text-xs"
          >
            {WATERMARK_TEXT}
          </span>
        ))}
      </div>
    </div>
  );
}
