import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseUrl } from '@/lib/supabase/env';

let adminClient: SupabaseClient | null = null;

/** عميل Supabase بصلاحيات service_role — للخادم فقط (إنشاء/حظر مستخدمين). */
export function createSupabaseAdminClient(): SupabaseClient {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  if (adminClient) return adminClient;

  adminClient = createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
