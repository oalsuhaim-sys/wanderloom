'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { partnerCrmProfilePath } from '@/lib/partner-dna';

/** توافق المسار القديم → ملف الشريك الموحّد */
export default function ExpertProfileRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const expertId = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!expertId) return;
    router.replace(partnerCrmProfilePath('experts', expertId));
  }, [expertId, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm font-bold text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      جاري التحويل لملف الشريك…
    </div>
  );
}
