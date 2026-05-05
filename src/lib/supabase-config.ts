/** يُستخدم في الواجهة والخادم للتحقق السريع من ضبط المتغيرات العامة. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  return Boolean(url && key);
}
