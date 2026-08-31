import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/credentials';

/** قراءة موحّدة — تُرجع المفاتيح المُثبتة مباشرة (تجاوز .env.local) */
export function getSupabaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim() ||
    (process.env.SUPABASE_URL ?? '').trim() ||
    supabaseUrl
  );
}

export function getSupabaseAnonKey(): string {
  return (
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() ||
    (process.env.SUPABASE_ANON_KEY ?? '').trim() ||
    supabaseAnonKey
  );
}

/**
 * Resolve service-role / secret key from common env names.
 * Strips quotes + optional "Bearer " prefix (Vercel / .env copy-paste artifacts).
 * Supports classic JWT service_role keys AND newer `sb_secret_…` keys.
 */
export function resolveSupabaseServiceRoleKey(): string {
  const raw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    '';
  let key = String(raw).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, '').trim();
  }
  return key;
}

export function getSupabaseServiceKey(): string {
  return resolveSupabaseServiceRoleKey() || supabaseAnonKey;
}

export function assertSupabaseConfig(): { url: string; anonKey: string } {
  return { url: getSupabaseUrl(), anonKey: getSupabaseAnonKey() };
}

export function supabaseConfigErrorMessage(): string {
  return '';
}
