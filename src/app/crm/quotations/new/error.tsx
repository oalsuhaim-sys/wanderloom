'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function NewQuotationError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[crm/quotations/new] route error boundary', error);
  }, [error]);

  const detail = error?.message?.trim() || error?.digest || 'خطأ غير متوقع';

  return (
    <div
      dir="rtl"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-white"
    >
      <AlertCircle className="h-10 w-10 text-[#D4AF37]" aria-hidden />
      <p className="max-w-md text-base font-bold">تعذّر تحميل صفحة عرض السعر</p>
      <p className="max-w-md break-words font-mono text-xs text-slate-400">{detail}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-6 py-2.5 text-sm font-bold text-[#D4AF37]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        إعادة المحاولة
      </button>
    </div>
  );
}
