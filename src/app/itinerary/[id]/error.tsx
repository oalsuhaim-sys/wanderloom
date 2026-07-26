'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ItineraryRouteError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[vip-itinerary] route error boundary', error);
  }, [error]);

  const detail = error?.message?.trim() || error?.digest || 'خطأ غير متوقع';

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 font-[family-name:var(--font-tajawal),system-ui,sans-serif] text-gray-900"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#2A362C]/60 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          aria-hidden
        >
          <AlertCircle className="h-7 w-7 text-[#D4AF37]" />
        </div>
        <div className="w-full rounded-2xl border border-[#D4AF37]/25 bg-[#2A362C]/50 px-6 py-5 text-start backdrop-blur-md">
          <p className="text-sm font-semibold leading-relaxed text-white/90">
            تعذّر تحميل صفحة المسار. حاول مرة أخرى أو تواصل مع الكونسيرج.
          </p>
          <p className="mt-2 break-words font-mono text-xs leading-relaxed text-[#D4AF37]/90">
            {detail}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/10 px-5 py-2.5 text-sm font-bold text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
