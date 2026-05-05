import type { PostgrestError } from '@supabase/supabase-js';

import { supabaseClient } from '../lib/supabaseClient';
import type { Session, SessionInsert } from '../types/session';

const CONFIG_ERROR = 'Supabase غير مهيأ: تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export type FetchSessionsResult =
  | { ok: true; data: Session[] }
  | { ok: false; error: string; details?: PostgrestError };

export type CreateSessionResult =
  | { ok: true; data: Session }
  | { ok: false; error: string; details?: PostgrestError };

function mapPostgrestError(error: PostgrestError): string {
  return error.message || 'خطأ من قاعدة البيانات';
}

/** جلب كل الجلسات مرتبة حسب التاريخ تصاعدياً. */
export async function fetchSessions(): Promise<FetchSessionsResult> {
  if (!supabaseClient) {
    return { ok: false, error: CONFIG_ERROR };
  }

  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    return { ok: false, error: mapPostgrestError(error), details: error };
  }

  return { ok: true, data: (data ?? []) as Session[] };
}

/** إدراج جلسة جديدة وإرجاع الصف المُنشأ (يتطلب RLS وسياسات مناسبة للمفتاح المستخدم). */
export async function createSession(payload: SessionInsert): Promise<CreateSessionResult> {
  if (!supabaseClient) {
    return { ok: false, error: CONFIG_ERROR };
  }

  const { data, error } = await supabaseClient
    .from('sessions')
    .insert(payload as Session)
    .select()
    .single();

  if (error) {
    return { ok: false, error: mapPostgrestError(error), details: error };
  }

  if (!data) {
    return { ok: false, error: 'لم تُرجع العملية أي صف؛ تحقق من سياسات RLS أو triggers الجدول.' };
  }

  return { ok: true, data: data as Session };
}
