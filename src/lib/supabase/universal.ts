import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** Browser / universal singleton — one client per JS runtime. */
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export { supabaseUrl, supabaseAnonKey };
export { supabase };
export type SupabaseUniversalClient = typeof supabase;

export function getSupabase() {
  return supabase;
}
