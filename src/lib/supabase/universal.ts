import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabaseUrl, supabaseAnonKey };
export { supabase };
export type SupabaseUniversalClient = typeof supabase;

export function getSupabase() {
  return supabase;
}
