'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { GroupTripTermsAgreement } from '@/app/group-onboarding/_components/GroupTripTermsAgreement';
import {
  buildGroupConfirmHref,
  readGroupRegistrationDraft,
  type GroupRegistrationDraft,
} from '@/lib/group-registration-contact';

function GroupOnboardingTermsContent() {
  const router = useRouter();
  const [draft, setDraft] = useState<GroupRegistrationDraft | null>(null);

  useEffect(() => {
    const stored = readGroupRegistrationDraft();
    if (!stored) {
      router.replace('/#groups');
      return;
    }
    setDraft(stored);
  }, [router]);

  if (!draft) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] px-4"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
      </main>
    );
  }

  const backHref = buildGroupConfirmHref();

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
      <GroupTripTermsAgreement draft={draft} backHref={backHref} />
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
