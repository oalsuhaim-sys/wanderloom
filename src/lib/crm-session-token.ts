import { supabase } from '@/lib/supabase';

/** يجلب access_token للجلسة الحالية — مع محاولة refresh قبل Server Actions */
export async function getClientAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase غير مهيأ.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token) {
    return sessionData.session.access_token;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('انتهت الجلسة — يرجى تسجيل الدخول مرة أخرى.');
  }

  const { data: retrySession } = await supabase.auth.getSession();
  if (retrySession.session?.access_token) {
    return retrySession.session.access_token;
  }

  throw new Error(
    refreshError?.message ?? 'تعذر التحقق من الجلسة — يرجى إعادة تسجيل الدخول.',
  );
}
