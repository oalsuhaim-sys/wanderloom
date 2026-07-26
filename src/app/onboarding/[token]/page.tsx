import { OnboardingDnaClient } from '@/app/onboarding/[token]/OnboardingDnaClient';
import { fetchWelcomeDnaPageDataAdmin } from '@/lib/client-onboarding-server';
import {
  resolveWelcomeDnaView,
  WELCOME_DNA_NOT_FOUND_MESSAGE,
} from '@/lib/client-onboarding';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function VipOnboardingPage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = String(rawToken ?? '').trim();

  if (!token) {
    return <OnboardingDnaClient token="" view="not_found" errorMessage="رابط التعارف غير صالح." />;
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return <OnboardingDnaClient token={token} view="not_found" errorMessage={serviceKeyError} />;
  }

  try {
    const data = await fetchWelcomeDnaPageDataAdmin(token);
    const view = resolveWelcomeDnaView(data);

    if (view === 'not_found') {
      return (
        <OnboardingDnaClient
          token={token}
          view="not_found"
          errorMessage={WELCOME_DNA_NOT_FOUND_MESSAGE}
        />
      );
    }

    return <OnboardingDnaClient token={token} view={view} profile={data!.profile} />;
  } catch (err) {
    return (
      <OnboardingDnaClient
        token={token}
        view="not_found"
        errorMessage={err instanceof Error ? err.message : 'تعذر تحميل النموذج.'}
      />
    );
  }
}
