import { WelcomeDnaClient } from '@/app/welcome/_components/WelcomeDnaClient';
import { ensureGroupDnaApplicationFromWelcome } from '@/app/actions/groupTripAssignmentActions';
import { fetchWelcomeDnaPageDataByClientIdAdmin } from '@/lib/client-onboarding-server';
import {
  isSupabaseUuid,
  resolveWelcomeDnaView,
  WELCOME_DNA_NOT_FOUND_MESSAGE,
} from '@/lib/client-onboarding';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

/** مسار CRM/legacy — /welcome/client/{client.id} (?flow=group يوسم طلب انضمام المجموعة) */
export default async function WelcomeClientDnaPage({ params, searchParams }: PageProps) {
  const { clientId: rawClientId } = await params;
  const clientId = String(rawClientId ?? '').trim();
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const flow = firstParam(resolvedSearch?.flow).toLowerCase();

  if (!clientId || (!/^\d+$/.test(clientId) && !isSupabaseUuid(clientId))) {
    return <WelcomeDnaClient token="" view="not_found" errorMessage="معرّف العميل غير صالح." />;
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return <WelcomeDnaClient token="" view="not_found" errorMessage={serviceKeyError} />;
  }

  if (flow === 'group' || flow === 'group_onboarding') {
    try {
      await ensureGroupDnaApplicationFromWelcome(clientId);
    } catch (err) {
      console.warn('[welcome/client] group DNA tag:', err);
    }
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
