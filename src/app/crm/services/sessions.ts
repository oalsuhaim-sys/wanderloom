import type { PostgrestError } from '@supabase/supabase-js';

import { getDemoSessions } from '@/lib/crm-demo';
import { supabaseClient } from '@/lib/supabaseClient';
import type { Session, SessionInsert } from '@/types/session-tables';

const CONFIG_ERROR = 'Supabase غير مهيأ: تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export type FetchSessionsResult =
  | { ok: true; data: Session[]; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

export type CreateSessionResult =
  | { ok: true; data: Session; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

export type UpdateSessionResult =
  | { ok: true; data: Session; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

export type DeleteSessionResult =
  | { ok: true; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

function mapPostgrestError(error: PostgrestError): string {
  return error.message || 'خطأ من قاعدة البيانات';
}

/** جلب كل الجلسات مرتبة حسب تاريخ الجلسة تصاعدياً. */
export async function fetchSessions(): Promise<FetchSessionsResult> {
  if (!supabaseClient) {
    return { ok: true, data: getDemoSessions(), demo: true };
  }

  try {
    const { data, error } = await supabaseClient.from('sessions').select('*').order('date', { ascending: true });

    if (error) {
      return { ok: false, error: mapPostgrestError(error), details: error };
    }

    return { ok: true, data: (data ?? []) as Session[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء جلب الجلسات.';
    return { ok: false, error: msg };
  }
}

/** إنشاء جلسة جديدة وإرجاع الصف المُنشأ (يشمل `created_at` من قاعدة البيانات عند التوفر). */
export async function createSession(payload: SessionInsert): Promise<CreateSessionResult> {
  if (!supabaseClient) {
    const mock = {
      ...payload,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    } as Session;
    return { ok: true, data: mock, demo: true };
  }

  try {
    const { data, error } = await supabaseClient
      .from('sessions')
      .insert(payload as Session)
      .select()
      .single();

    if (error) {
      return { ok: false, error: mapPostgrestError(error), details: error };
    }

    if (!data) {
      return { ok: false, error: 'لم تُرجع العملية أي صف؛ تحقق من سياسات RLS أو القيود على الجدول.' };
    }

    return { ok: true, data: data as Session };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء إنشاء الجلسة.';
    return { ok: false, error: msg };
  }
}

export async function updateSession(
  sessionId: string,
  payload: SessionInsert
): Promise<UpdateSessionResult> {
  if (!supabaseClient) {
    const mock = {
      ...payload,
      id: sessionId,
      created_at: new Date().toISOString(),
    } as Session;
    return { ok: true, data: mock, demo: true };
  }

  try {
    const { data, error } = await supabaseClient
      .from('sessions')
      .update(payload as Session)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return { ok: false, error: mapPostgrestError(error), details: error };
    }

    if (!data) {
      return { ok: false, error: 'تعذر تحديث الجلسة؛ لم تُرجع قاعدة البيانات أي صف.' };
    }

    return { ok: true, data: data as Session };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء تحديث الجلسة.';
    return { ok: false, error: msg };
  }
}

export async function deleteSession(sessionId: string): Promise<DeleteSessionResult> {
  if (!supabaseClient) {
    return { ok: true, demo: true };
  }

  try {
    const { error } = await supabaseClient.from('sessions').delete().eq('id', sessionId);
    if (error) {
      return { ok: false, error: mapPostgrestError(error), details: error };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء حذف الجلسة.';
    return { ok: false, error: msg };
  }
}
