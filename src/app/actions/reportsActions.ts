'use server';

import { fetchCrmReportsSnapshotAdmin } from '@/lib/crm-reports-server';
import type { CrmReportsSnapshot } from '@/lib/crm-reports';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

export type GetCrmReportsResult =
  | { ok: true; snapshot: CrmReportsSnapshot }
  | { ok: false; error: string };

export async function getCrmReportsAction(): Promise<GetCrmReportsResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const snapshot = await fetchCrmReportsSnapshotAdmin();
    return { ok: true, snapshot };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل التقارير.',
    };
  }
}
