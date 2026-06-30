import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** يُستخدم في الواجهة والخادم — دائماً true أثناء تجاوز env */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
