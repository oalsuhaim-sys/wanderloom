'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { InterviewCalendar } from '@/app/dna/_components/InterviewCalendar';
import { GroupOnboardingStepNav } from '@/app/group-onboarding/_components/GroupOnboardingStepNav';
import { readGroupRegistrationDraft } from '@/lib/group-registration-contact';

function GroupOnboardingConfirmContent() {
  const router = useRouter();
  const draft = readGroupRegistrationDraft();

  useEffect(() => {
    if (!draft) {
      router.replace('/#groups');
    }
  }, [draft, router]);

  if (!draft) {
    return (
      <main
        dir="rtl"
        className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] px-4 text-sm font-bold text-gray-500"
      >
        <Loader2 className="me-2 h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
        جاري التحميل…
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-dvh overflow-x-hidden bg-[#FDFBF7] px-3 py-6 sm:px-4 sm:py-10"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,6,0.12), transparent 55%)',
      }}
    >
      <div className="mx-auto mb-4 max-w-2xl">
        <GroupOnboardingStepNav
          currentStep={2}
          onBack={() => router.push(`/group-onboarding?tripId=${encodeURIComponent(draft.preferred_trip_id)}`)}
        />
        <p className="mt-3 text-center text-xs font-semibold text-slate-600">
          {draft.trip_label} — {draft.full_name}
        </p>
      </div>

      <InterviewCalendar
        draftMode
        enableDirectBooking
        onBack={() => router.push(`/group-onboarding?tripId=${encodeURIComponent(draft.preferred_trip_id)}`)}
        onBooked={() => router.push('/group-onboarding/terms')}
      />
    </main>
  );
}

export default function GroupOnboardingConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#FDFBF7] text-sm font-bold text-gray-500">
          <Loader2 className="me-2 h-5 w-5 animate-spin text-[#C5A059]" aria-hidden />
          جاري التحميل…
        </div>
      }
    >
      <GroupOnboardingConfirmContent />
    </Suspense>
  );
}
