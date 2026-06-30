import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** قراءة موحّدة — تُرجع المفاتيح المُثبتة مباشرة (تجاوز .env.local) */
export function getSupabaseUrl(): string {
  return supabaseUrl;
}

export function getSupabaseAnonKey(): string {
  return supabaseAnonKey;
}

export function getSupabaseServiceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() || supabaseAnonKey;
}

export function assertSupabaseConfig(): { url: string; anonKey: string } {
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export function supabaseConfigErrorMessage(): string {
  return '';
}
