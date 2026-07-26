'use server';

import { fetchClientFinancialHubAdmin } from '@/lib/client-financial-hub-server';
import type { ClientFinancialHubData } from '@/lib/client-financial-hub';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type GetClientFinancialHubResult =
  | { ok: true; data: ClientFinancialHubData }
  | { ok: false; error: string };

export async function getClientFinancialHubAction(
  clientId: string,
): Promise<GetClientFinancialHubResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const data = await fetchClientFinancialHubAdmin(clientId);
    if (!data) return { ok: false, error: 'تعذر تحميل الملخص المالي للعميل.' };
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل الملخص المالي.',
    };
  }
}
