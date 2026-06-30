'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** يوجّه إلى نموذج الإنشاء في وضع التعديل */
export default function EditQuotationRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quoteId = String(params?.id ?? '').trim();

  useEffect(() => {
    if (!quoteId) {
      router.replace('/crm/quotations');
      return;
    }
    router.replace(`/crm/quotations/new?edit=${encodeURIComponent(quoteId)}`);
  }, [quoteId, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center font-black text-slate-500">
      <Loader2 className="me-2 h-6 w-6 animate-spin" aria-hidden />
      جاري فتح محرر العرض…
    </div>
  );
}
