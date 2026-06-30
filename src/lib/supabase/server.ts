import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** عميل Supabase للخادم (Server Components / Route Handlers / Server Actions) */
export function createServerSupabase(): SupabaseClient {
  return supabase;
}

export function createServerSupabaseAnon(): SupabaseClient {
  return supabase;
}
