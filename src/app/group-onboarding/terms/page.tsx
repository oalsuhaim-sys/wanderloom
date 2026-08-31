'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { GroupTripTermsAgreement } from '@/app/group-onboarding/_components/GroupTripTermsAgreement';

function GroupOnboardingTermsContent() {
  const searchParams = useSearchParams();
  const leadId = String(searchParams.get('leadId') ?? '').trim();

  if (!leadId) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] px-4"
      >
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-bold text-rose-900">رابط الشروط غير مكتمل.</p>
          <Link
            href="/#groups"
            className="mt-4 inline-flex rounded-xl bg-[#1e3f20] px-5 py-2.5 text-xs font-black text-[#cda04c]"
          >
            العودة للرحلات
          </Link>
        </div>
      </main>
    );
  }

  const backHref = `/dna/${encodeURIComponent(leadId)}?flow=group_onboarding&step=confirm`;

  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-dvh overflow-x-hidden bg-[#FDFBF7] px-4 py-8 sm:py-12"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,6,0.12), transparent 55%)',
      }}
    >
      <GroupTripTermsAgreement leadId={leadId} backHref={backHref} />
    </main>
  );
}

export default function GroupOnboardingTermsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] text-sm font-bold text-gray-500">
          <Loader2 className="me-2 h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
          جاري التحميل…
        </div>
      }
    >
      <GroupOnboardingTermsContent />
    </Suspense>
  );
}
