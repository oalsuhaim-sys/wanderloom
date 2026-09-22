import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseUrl, resolveSupabaseServiceRoleKey } from '@/lib/supabase/env';

/** Process-wide singleton — reuse across API routes / RSC / actions (no re-auth). */
let adminClient: SupabaseClient | null = null;

/**
 * Warn if a classic JWT key is clearly the anon key (SELECT-miss + INSERT 23505 under RLS).
 * Newer `sb_secret_…` keys are not JWTs — do not reject them.
 */
function warnIfAnonJwt(serviceKey: string): void {
  const parts = serviceKey.split('.');
  if (parts.length !== 3) return; // not a JWT (e.g. sb_secret_…) — OK
  try {
    const json = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const payload = JSON.parse(json) as { role?: string };
    if (payload.role && payload.role !== 'service_role') {
      console.warn(
        `[supabase-admin] key JWT role is «${payload.role}» — expected service_role. RLS bypass may fail.`,
      );
    }
  } catch {
    /* ignore decode issues */
  }
}

/**
 * عميل Supabase بصلاحيات service_role — للخادم فقط.
 * Always returns the same process singleton (connection reuse).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const serviceKey = resolveSupabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error(
      'Missing Supabase Service Key — set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) on the server.',
    );
  }

  warnIfAnonJwt(serviceKey);

  adminClient = createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  });
  return adminClient;
}

/** Explicit alias — prefer this name at call sites that want reuse clarity. */
export function getSupabaseAdminClient(): SupabaseClient {
  return createSupabaseAdminClient();
}
