'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { normalizeQuotationId } from '@/lib/crm-quotations';
import { QuoteBuilderForm } from '@/app/crm/quotations/_components/QuoteBuilderForm';

function NewQuotationPageContent() {
  const searchParams = useSearchParams();
  const editQuoteId = normalizeQuotationId(searchParams.get('edit'));
  const isEditMode = Boolean(editQuoteId);

  return <QuoteBuilderForm editQuoteId={editQuoteId} isEditMode={isEditMode} />;
}

function NewQuotationPageFallback() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center gap-2 pb-10 font-black text-slate-500"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      جاري التحميل…
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<NewQuotationPageFallback />}>
      <NewQuotationPageContent />
    </Suspense>
  );
}
