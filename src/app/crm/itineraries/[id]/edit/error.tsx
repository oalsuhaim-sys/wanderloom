'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function EditItineraryError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[crm-itinerary-edit] route error boundary', error);
  }, [error]);

  const detail = error?.message?.trim() || error?.digest || 'خطأ غير متوقع';

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAFA] px-6 text-center text-[#1E2720]"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#2A362C]/10">
        <AlertCircle className="h-7 w-7 text-[#D4AF37]" aria-hidden />
      </div>
      <p className="max-w-md text-base font-bold text-gray-800">
        تعذّر تحميل محرّر المسار. حاول مرة أخرى.
      </p>
      <p className="max-w-md break-words font-mono text-xs text-gray-500">{detail}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1A2520] px-6 py-2.5 text-sm font-bold text-[#D4AF37]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        إعادة المحاولة
      </button>
    </div>
  );
}
