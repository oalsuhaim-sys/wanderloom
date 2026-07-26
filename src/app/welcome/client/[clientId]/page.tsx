import { WelcomeDnaClient } from '@/app/welcome/_components/WelcomeDnaClient';
import { fetchWelcomeDnaPageDataByClientIdAdmin } from '@/lib/client-onboarding-server';
import {
  isSupabaseUuid,
  resolveWelcomeDnaView,
  WELCOME_DNA_NOT_FOUND_MESSAGE,
} from '@/lib/client-onboarding';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type PageProps = {
  params: Promise<{ clientId: string }>;
};

/** مسار CRM/legacy — /welcome/client/{client.id} */
export default async function WelcomeClientDnaPage({ params }: PageProps) {
  const { clientId: rawClientId } = await params;
  const clientId = String(rawClientId ?? '').trim();

  if (!clientId || (!/^\d+$/.test(clientId) && !isSupabaseUuid(clientId))) {
    return <WelcomeDnaClient token="" view="not_found" errorMessage="معرّف العميل غير صالح." />;
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return <WelcomeDnaClient token="" view="not_found" errorMessage={serviceKeyError} />;
  }

  try {
    const data = await fetchWelcomeDnaPageDataByClientIdAdmin(clientId);
    const view = resolveWelcomeDnaView(data);

    if (view === 'not_found' || !data) {
      return (
        <WelcomeDnaClient
          token=""
          view="not_found"
          errorMessage={WELCOME_DNA_NOT_FOUND_MESSAGE}
        />
      );
    }

    return (
      <WelcomeDnaClient
        token={data.onboardingToken}
        view={view}
        profile={data.profile}
      />
    );
  } catch (err) {
    return (
      <WelcomeDnaClient
        token=""
        view="not_found"
        errorMessage={err instanceof Error ? err.message : 'تعذر تحميل النموذج.'}
      />
    );
  }
}
