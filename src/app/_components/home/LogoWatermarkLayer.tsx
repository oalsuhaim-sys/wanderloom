'use client';

/**
 * Global fixed watermark — sits behind all landing-page sections while scrolling.
 */
export function LogoWatermarkLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden opacity-[0.04]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wanderloom.png"
        alt=""
        className="w-[min(90vw,800px)] max-w-none mix-blend-multiply"
      />
    </div>
  );
}
