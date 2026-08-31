'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import GroupPricingEngine from '@/app/crm/groups/_components/GroupPricingEngine';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';

function PricingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 bg-[#f8fafc] text-sm font-medium text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#b8952d]" />
      جاري تحميل حاسبة التسعير…
    </div>
  );
}

export default function GroupPricingPage() {
  return (
    <ClientErrorBoundary
      fallbackTitle="تعذّر تحميل حاسبة تسعير القروب"
      fallbackMessage="حدث خطأ أثناء عرض محرك التسعير. حدّث الصفحة أو تحقق من الصلاحيات."
    >
      <Suspense fallback={<PricingFallback />}>
        <GroupPricingEngine />
      </Suspense>
    </ClientErrorBoundary>
  );
}
