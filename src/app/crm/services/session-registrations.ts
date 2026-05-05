import type { PostgrestError } from '@supabase/supabase-js';

import { getDemoRegistrations } from '@/lib/crm-demo';
import { supabaseClient } from '@/lib/supabaseClient';
import type { SessionRegistration } from '@/types/session-tables';

export type FetchSessionRegistrationsResult =
  | { ok: true; data: SessionRegistration[]; demo?: boolean }
  | { ok: false; error: string; details?: PostgrestError };

function mapPostgrestError(error: PostgrestError): string {
  return error.message || 'خطأ من قاعدة البيانات';
}

/**
 * جلب تسجيلات العملاء لمجموعة جلسات، مرتبة من الأحدث إلى الأقدم حسب `created_at`.
 */
export async function fetchSessionRegistrations(sessionIds: string[]): Promise<FetchSessionRegistrationsResult> {
  const ids = sessionIds.filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, data: [] };
  }

  if (!supabaseClient) {
    const all = getDemoRegistrations();
    const filtered = all.filter((r) => ids.includes(String(r.session_id)));
    filtered.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    return { ok: true, data: filtered, demo: true };
  }

  const { data, error } = await supabaseClient
    .from('session_registrations')
    .select('*')
    .in('session_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, error: mapPostgrestError(error), details: error };
  }

  const rows = (data ?? []) as SessionRegistration[];
  rows.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  return { ok: true, data: rows };
}
