'use server';

import { revalidatePath } from 'next/cache';

import {
  bankDetailsFromEnv,
  mapSystemSettingsBank,
  mergeBankDetails,
  type AgencyBankDetails,
} from '@/lib/system-settings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
} from '@/lib/supabase/server-action-auth';

export type SystemSettingsActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function ensureSettingsRow(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  const { data } = await admin.from('system_settings').select('id').eq('id', 1).maybeSingle();
  if (data?.id) return;
  await admin.from('system_settings').insert({
    id: 1,
    bank_name: null,
    account_name: null,
    iban: null,
  });
}

/** قراءة تفاصيل البنك — للوحة الإعدادات (أدمن) أو صفحة السداد العامة. */
export async function fetchAgencyBankDetailsAction(
  accessToken?: string | null,
  opts?: { requireAdmin?: boolean },
): Promise<SystemSettingsActionResult<AgencyBankDetails>> {
  if (opts?.requireAdmin) {
    const auth = await requireAdminServerAction(accessToken);
    if (!auth.ok) return { ok: false, error: auth.error };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    // Still return env fallbacks so checkout UI doesn't break
    return { ok: true, data: mergeBankDetails(bankDetailsFromEnv()) };
  }

  try {
    const admin = createSupabaseAdminClient();
    await ensureSettingsRow(admin);
    const { data, error } = await admin
      .from('system_settings')
      .select('bank_name, account_name, iban')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message ?? '')) {
        return {
          ok: true,
          data: mergeBankDetails(bankDetailsFromEnv()),
          message:
            'جدول system_settings غير موجود — تُعرض قيم البيئة. نفّذ supabase/sql/system_settings.sql',
        };
      }
      return { ok: false, error: error.message || 'تعذر قراءة إعدادات البنك.' };
    }

    return {
      ok: true,
      data: mergeBankDetails(mapSystemSettingsBank(data as Record<string, unknown> | null)),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر قراءة إعدادات البنك.',
    };
  }
}

/** تحديث تفاصيل البنك — أدمن فقط. */
export async function updateAgencyBankDetailsAction(input: {
  bank_name: string;
  account_name: string;
  iban: string;
  access_token?: string | null;
}): Promise<SystemSettingsActionResult<AgencyBankDetails>> {
  const auth = await requireAdminServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const bank_name = String(input.bank_name ?? '').trim();
  const account_name = String(input.account_name ?? '').trim();
  const iban = String(input.iban ?? '').trim().replace(/\s+/g, '');

  if (!bank_name || !account_name || !iban) {
    return { ok: false, error: 'اسم البنك واسم الحساب والآيبان مطلوبة.' };
  }

  try {
    const admin = createSupabaseAdminClient();
    await ensureSettingsRow(admin);

    const { data, error } = await admin
      .from('system_settings')
      .update({
        bank_name,
        account_name,
        iban,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('bank_name, account_name, iban')
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message ?? '')) {
        return {
          ok: false,
          error: 'جدول system_settings غير موجود — نفّذ supabase/sql/system_settings.sql في محرّر SQL.',
        };
      }
      return { ok: false, error: error.message || 'تعذر حفظ إعدادات البنك.' };
    }

    revalidatePath('/crm/settings');
    revalidatePath('/dashboard/settings');

    return {
      ok: true,
      message: 'تم حفظ تفاصيل الحساب البنكي.',
      data: mapSystemSettingsBank(data as Record<string, unknown> | null),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حفظ إعدادات البنك.',
    };
  }
}
