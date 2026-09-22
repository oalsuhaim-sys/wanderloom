import 'server-only';

import {
  mapDbSocialRow,
  mergeSocialCredentials,
  socialCredentialsFromEnv,
  type SocialSchedulerCredentials,
} from '@/lib/social-scheduler-settings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';

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

/** Full credentials for scheduling APIs (DB preferred, env fallback). */
export async function resolveSocialSchedulerCredentials(): Promise<SocialSchedulerCredentials> {
  const fromEnv = socialCredentialsFromEnv();
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) return fromEnv;

  try {
    const admin = createSupabaseAdminClient();
    await ensureSettingsRow(admin);
    const { data, error } = await admin
      .from('system_settings')
      .select('social_provider, social_api_key, social_extra')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache|column/i.test(error.message ?? '')) {
        return fromEnv;
      }
      return fromEnv;
    }

    return mergeSocialCredentials(mapDbSocialRow(data), fromEnv);
  } catch {
    return fromEnv;
  }
}
