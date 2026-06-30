'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { normalizeAffiliateRef, persistAffiliateRef } from '@/lib/referral-url';

function AffiliateReferralCaptureInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const ref = normalizeAffiliateRef(searchParams.get('ref'));
    if (!ref) return;
    persistAffiliateRef(ref);
    if (pathname === '/') {
      router.replace(`/join?ref=${encodeURIComponent(ref)}`);
    }
  }, [searchParams, pathname, router]);

  return null;
}

/** يلتقط ?ref= من الرابط ويحفظه للنموذج — بدون تسجيل دخول */
export function AffiliateReferralCapture() {
  return (
    <Suspense fallback={null}>
      <AffiliateReferralCaptureInner />
    </Suspense>
  );
}
