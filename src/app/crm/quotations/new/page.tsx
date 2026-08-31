import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import NewQuotationClient from './NewQuotationClient';

function PageFallback() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center gap-2 px-4 pb-10 font-black text-[#D4AF37]"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      جاري تحميل الشاشة…
    </div>
  );
}

/** Server page — Suspense boundary required for useSearchParams in the client child. */
export default function NewQuotationPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewQuotationClient />
    </Suspense>
  );
}
