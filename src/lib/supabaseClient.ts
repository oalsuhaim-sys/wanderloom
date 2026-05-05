import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** عميل Supabase؛ يكون `null` إذا لم تُضبط متغيرات البيئة. */
export const supabaseClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (typeof window !== 'undefined' && !supabaseClient) {
  // يساعدك في الـ Debug: غالباً المشكلة أن .env.local لم تُضبط أو لم يتم تشغيل dev restart.
  console.warn('[supabaseClient] supabaseClient is null. Check .env.local NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}
