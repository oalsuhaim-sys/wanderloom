import { createClient } from '@supabase/supabase-js';

export type E2EEnv = {
  baseURL: string;
  email: string;
  password: string;
  supabaseUrl: string;
  serviceRoleKey: string;
};

export function loadE2EEnv(): E2EEnv {
  const baseURL = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const email = (
    process.env.E2E_CRM_EMAIL ||
    process.env.ADMIN_EMAIL ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');
  const password = (process.env.E2E_CRM_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  return { baseURL, email, password, supabaseUrl, serviceRoleKey };
}

export function requireAuthEnv(env: E2EEnv): void {
  if (!env.email || !env.password) {
    throw new Error(
      'Missing E2E_CRM_EMAIL / E2E_CRM_PASSWORD (or ADMIN_EMAIL + E2E_CRM_PASSWORD). See e2e/.env.example',
    );
  }
}

export function createAdminClient(env: E2EEnv) {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error(
      'Lead seeding needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. See e2e/.env.example',
    );
  }
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
