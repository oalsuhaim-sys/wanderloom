'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { confirmGroupDirectBooking } from '@/app/actions/groupOnboardingActions';
import { brandGoldButtonStyle } from '@/lib/brand-gold';

import { GroupOnboardingStepNav } from './GroupOnboardingStepNav';
import {
  GroupTripTermsCharterArticles,
  GroupTripTermsCharterHeader,
  GroupTripTermsCharterIntro,
  GroupTripTermsMediaConsent,
} from './group-trip-terms-charter';
import { RegistrationSuccessStep } from './RegistrationSuccessStep';

type SuccessState = {
  fullName: string;
  tripTitle: string;
  placement: 'confirmed_seat' | 'waitlisted';
  checkoutPath: string;
  message: string;
};

type Props = {
  leadId: string;
  backHref: string;
  onWaitlisted?: () => void;
  onBooked?: () => void;
};

export function GroupTripTermsAgreement({ leadId, backHref, onWaitlisted, onBooked }: Props) {
  const router = useRouter();
  const [mediaConsent, setMediaConsent] = useState(true);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<SuccessState | null>(null);

  function handleGoBack() {
    router.push(backHref);
  }

  function handleFinalSubmit() {
    startTransition(async () => {
      const result = await confirmGroupDirectBooking(leadId, true, mediaConsent);
      if (!result.ok) {
        toast.error(result.error || 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مجدداً');
        return;
      }

      if (onWaitlisted && result.placement === 'waitlisted') {
        onWaitlisted();
        return;
      }
      if (onBooked && result.placement === 'confirmed_seat') {
        onBooked();
        return;
      }

      setSuccess({
        fullName: result.fullName,
        tripTitle: result.tripTitle,
        placement: result.placement,
        checkoutPath: result.checkoutPath,
        message: result.message,
      });
    });
  }

  if (success) {
    return (
      <RegistrationSuccessStep
        fullName={success.fullName}
        tripTitle={success.tripTitle}
        placement={success.placement}
        checkoutPath={success.checkoutPath || undefined}
        waitlistMessage={success.placement === 'waitlisted' ? success.message : undefined}
      />
    );
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-bold' }} />
      <div
        className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm sm:p-10"
        dir="rtl"
        lang="ar"
      >
        <GroupOnboardingStepNav
          currentStep={3}
          onBack={handleGoBack}
          backDisabled={pending}
        />

        <GroupTripTermsCharterHeader variant="page" />
        <GroupTripTermsCharterIntro variant="page" />
        <GroupTripTermsCharterArticles variant="page" />
        <GroupTripTermsMediaConsent
          mediaConsent={mediaConsent}
          onMediaConsentChange={setMediaConsent}
        />

        <div className="border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={pending}
            style={brandGoldButtonStyle}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-xs font-extrabold shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            الموافقة وتأكيد انضمامي للرحلة ➔
          </button>
        </div>
      </div>
    </>
  );
}
