import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** Process-wide singleton — never re-create on each Server Component / action call. */
const serverSupabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** عميل Supabase للخادم (Server Components / Route Handlers / Server Actions) */
export function createServerSupabase(): SupabaseClient {
  return serverSupabase;
}

export function createServerSupabaseAnon(): SupabaseClient {
  return serverSupabase;
}
