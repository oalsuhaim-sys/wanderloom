import { WelcomeDnaClient } from '@/app/welcome/_components/WelcomeDnaClient';
import {
  ensureOnboardingTokenAdmin,
  fetchWelcomeDnaPageDataByClientIdAdmin,
  fetchWelcomeDnaPageDataAdmin,
} from '@/lib/client-onboarding-server';
import {
  isClientRecordIdKey,
  resolveWelcomeDnaView,
  WELCOME_DNA_NOT_FOUND_MESSAGE,
} from '@/lib/client-onboarding';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * /welcome/vip/{clients.id} أو /welcome/vip/{onboarding_token}
 * SSOT: دائماً يُحلّ إلى صف في جدول clients.
 */
export default async function WelcomeVipDnaPage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(String(rawToken ?? '').trim());

  if (!token) {
    return <WelcomeDnaClient token="" view="not_found" errorMessage="رابط التعارف غير صالح." />;
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return <WelcomeDnaClient token={token} view="not_found" errorMessage={serviceKeyError} />;
  }

  try {
    // Numeric / UUID client id → preferred SSOT path
    const data = isClientRecordIdKey(token)
      ? (await fetchWelcomeDnaPageDataByClientIdAdmin(token)) ??
        (await fetchWelcomeDnaPageDataAdmin(token))
      : await fetchWelcomeDnaPageDataAdmin(token);

    const view = resolveWelcomeDnaView(data);

    if (view === 'not_found' || !data) {
      return (
        <WelcomeDnaClient
          token={token}
          view="not_found"
          errorMessage={WELCOME_DNA_NOT_FOUND_MESSAGE}
        />
      );
    }

    const submitToken =
      'onboardingToken' in data && data.onboardingToken
        ? String(data.onboardingToken)
        : isClientRecordIdKey(token)
          ? await ensureOnboardingTokenAdmin(data.profile.client_id)
          : token;

    return <WelcomeDnaClient token={submitToken} view={view} profile={data.profile} />;
  } catch (err) {
    return (
      <WelcomeDnaClient
        token={token}
        view="not_found"
        errorMessage={err instanceof Error ? err.message : 'تعذر تحميل النموذج.'}
      />
    );
  }
}
