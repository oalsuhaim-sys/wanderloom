'use server';

import { revalidatePath } from 'next/cache';

import {
  bankDetailsFromEnv,
  mapSystemSettingsBank,
  mergeBankDetails,
  type AgencyBankDetails,
} from '@/lib/system-settings';
import {
  mapDbSocialRow,
  mergeSocialCredentials,
  normalizeSocialProvider,
  socialCredentialsFromEnv,
  toPublicSocialStatus,
  type SocialSchedulerProvider,
  type SocialSchedulerPublicStatus,
} from '@/lib/social-scheduler-settings';
import { resolveSocialSchedulerCredentials } from '@/lib/social-scheduler-credentials.server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  assertServiceRoleKeyConfigured,
  requireAdminServerAction,
  requireCrmServerAction,
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

/** @deprecated use resolve from social-scheduler-credentials.server — re-exported for callers */
export { resolveSocialSchedulerCredentials };

/** قراءة حالة المجدول الاجتماعي (بدون كشف المفتاح الكامل). */
export async function fetchSocialSchedulerSettingsAction(
  accessToken?: string | null,
): Promise<SystemSettingsActionResult<SocialSchedulerPublicStatus>> {
  const auth = await requireCrmServerAction(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const creds = await resolveSocialSchedulerCredentials();
  return { ok: true, data: toPublicSocialStatus(creds) };
}

/** حفظ مفتاح Buffer / Metricool في system_settings — موظفو CRM. */
export async function updateSocialSchedulerSettingsAction(input: {
  provider: SocialSchedulerProvider | string;
  apiKey: string;
  extra?: string;
  /** If true and apiKey empty, keep existing DB key */
  keepExistingKey?: boolean;
  access_token?: string | null;
}): Promise<SystemSettingsActionResult<SocialSchedulerPublicStatus>> {
  const auth = await requireCrmServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!auth.access.is_admin && !auth.access.permissions?.can_access_marketing) {
    return { ok: false, error: 'صلاحية التسويق مطلوبة لحفظ إعدادات الربط.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  const provider = normalizeSocialProvider(input.provider);
  if (provider === 'none') {
    return { ok: false, error: 'اختر مزوّد الجدولة: Metricool أو Buffer.' };
  }

  let apiKey = String(input.apiKey ?? '').trim();
  const extra = String(input.extra ?? '').trim();

  try {
    const admin = createSupabaseAdminClient();
    await ensureSettingsRow(admin);

    if (!apiKey && input.keepExistingKey) {
      const { data: existing } = await admin
        .from('system_settings')
        .select('social_api_key')
        .eq('id', 1)
        .maybeSingle();
      apiKey = String(
        (existing as { social_api_key?: string } | null)?.social_api_key ?? '',
      ).trim();
    }

    if (!apiKey) {
      return {
        ok: false,
        error:
          provider === 'buffer'
            ? 'أدخل BUFFER Access Token.'
            : 'أدخل METRICOOL API Key.',
      };
    }

    if (provider === 'buffer' && !extra) {
      return {
        ok: false,
        error: 'أدخل BUFFER Profile IDs (معرّفات الملفات مفصولة بفاصلة).',
      };
    }

    const { data, error } = await admin
      .from('system_settings')
      .update({
        social_provider: provider,
        social_api_key: apiKey,
        social_extra: extra || null,
        social_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('social_provider, social_api_key, social_extra')
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache|column/i.test(error.message ?? '')) {
        return {
          ok: false,
          error:
            'أعمدة الربط الاجتماعي غير موجودة — نفّذ supabase/sql/system_settings_social.sql في محرّر SQL.',
        };
      }
      return { ok: false, error: error.message || 'تعذر حفظ إعدادات الربط.' };
    }

    revalidatePath('/crm/marketing');
    revalidatePath('/admin/marketing');

    const status = toPublicSocialStatus(
      mergeSocialCredentials(mapDbSocialRow(data), socialCredentialsFromEnv()),
    );

    return {
      ok: true,
      message: status.message,
      data: status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر حفظ إعدادات الربط.',
    };
  }
}

/** مسح مفاتيح الجدولة من قاعدة البيانات (يبقى env إن وُجد). */
export async function clearSocialSchedulerSettingsAction(input: {
  access_token?: string | null;
}): Promise<SystemSettingsActionResult<SocialSchedulerPublicStatus>> {
  const auth = await requireCrmServerAction(input.access_token);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!auth.access.is_admin && !auth.access.permissions?.can_access_marketing) {
    return { ok: false, error: 'صلاحية التسويق مطلوبة.' };
  }

  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return { ok: false, error: serviceKeyError };

  try {
    const admin = createSupabaseAdminClient();
    await ensureSettingsRow(admin);
    const { error } = await admin
      .from('system_settings')
      .update({
        social_provider: null,
        social_api_key: null,
        social_extra: null,
        social_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      return { ok: false, error: error.message || 'تعذر مسح الإعدادات.' };
    }

    revalidatePath('/crm/marketing');
    const status = toPublicSocialStatus(await resolveSocialSchedulerCredentials());
    return { ok: true, message: 'تم مسح مفاتيح قاعدة البيانات.', data: status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر مسح الإعدادات.',
    };
  }
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
          error:
            'جدول system_settings غير موجود — نفّذ supabase/sql/system_settings.sql في محرّر SQL.',
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
