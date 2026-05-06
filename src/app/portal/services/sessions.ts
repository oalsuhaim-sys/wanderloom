import type { PostgrestError } from '@supabase/supabase-js';

import { getDemoSessions } from '@/lib/crm-demo';
import { supabaseClient } from '@/lib/supabaseClient';
import type { Session } from '@/types/session-tables';

export type FetchAvailableSessionsResult =
  | { ok: true; data: Session[]; demo?: boolean }
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

