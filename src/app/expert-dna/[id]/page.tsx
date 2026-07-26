'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** توافق الرابط القديم → بصمة الشريك الموحّدة */
export default function ExpertDnaRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const expertId = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!expertId) return;
    router.replace(`/partner-dna/experts/${encodeURIComponent(expertId)}`);
  }, [expertId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0D0C]">
      <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
    </div>
  );
}
