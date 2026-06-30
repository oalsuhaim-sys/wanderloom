'use client';

import { useState } from 'react';

const LOGO_PRIMARY = '/wanderloom_logo_hq.jpg';
const LOGO_FALLBACK = '/icon-512.png';

/** طبقة شعار خافتة — تتحول تلقائياً إلى icon-512.png إذا لم يُرفع wanderloom_logo_hq.jpg */
export function LogoWatermarkLayer() {
  const [src, setSrc] = useState(LOGO_PRIMARY);

  return (
    <>
      <img
        aria-hidden
        alt=""
        src={src}
        onError={() => {
          if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK);
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-auto w-[min(88vw,640px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-[0.045] sm:opacity-[0.06]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(30,63,32,0.06),transparent_55%)]"
      />
    </>
  );
}
