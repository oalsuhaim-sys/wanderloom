import type { PostgrestError } from '@supabase/supabase-js';

import { getDemoSessions } from '@/lib/crm-demo';
import { supabaseClient } from '@/lib/supabaseClient';
import type { Session, SessionRegistration, SessionRegistrationInsert } from '@/types/session-tables';

export type FetchAvailableSessionsResult =
  | { ok: true; data: Session[]; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

export type RegisterForSessionResult =
  | { ok: true; data: SessionRegistration; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

function mapPostgrestError(error: PostgrestError): string {
  return error.message || 'خطأ من قاعدة البيانات';
}

function sessionOnOrAfterToday(dateStr: string): boolean {
  const day = String(dateStr).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return day >= today;
}

function filterUpcoming(sessions: Session[]): Session[] {
  return sessions.filter((s) => sessionOnOrAfterToday(String(s.date)));
}

/** جلب جلسات العملاء من جدول sessions مرتبة حسب التاريخ. */
export async function fetchAvailableSessions(): Promise<FetchAvailableSessionsResult> {
  if (!supabaseClient) {
    return { ok: true, data: filterUpcoming(getDemoSessions()), demo: true };
  }

  try {
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('*')
      .order('date', { ascending: true });

    if (error) return { ok: false, error: mapPostgrestError(error), details: error };
    return { ok: true, data: filterUpcoming((data ?? []) as Session[]) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء جلب الجلسات.';
    return { ok: false, error: msg };
  }
}

/**
 * تسجيل عميل في جلسة.
 * لا نرسل `created_at` في الإدراج؛ نعتمد على القيمة الافتراضية في Supabase ثم نقرأها من `.select()`.
 */
export async function registerForSession(
  payload: SessionRegistrationInsert
): Promise<RegisterForSessionResult> {
  if (!supabaseClient) {
    const mock: SessionRegistration = {
      id: crypto.randomUUID(),
      session_id: payload.session_id,
      name: payload.name,
      whatsapp: payload.whatsapp,
      created_at: new Date().toISOString(),
    };
    return { ok: true, data: mock, demo: true };
  }

  try {
    const { data, error } = await supabaseClient
      .from('session_registrations')
      .insert({
        session_id: payload.session_id,
        name: payload.name,
        whatsapp: payload.whatsapp,
      })
      .select()
      .single();

    if (error) return { ok: false, error: mapPostgrestError(error), details: error };

    if (!data) {
      return { ok: false, error: 'لم يتم إنشاء سجل التسجيل؛ تحقق من الصلاحيات والقيود.' };
    }

    return { ok: true, data: data as SessionRegistration };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع أثناء التسجيل.';
    return { ok: false, error: msg };
  }
}
