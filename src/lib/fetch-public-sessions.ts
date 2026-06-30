import { supabase } from '@/lib/supabase/universal';

import type { Session } from '@/types/session-tables';
import { ar } from '@/messages/ar';

export type FetchPublicSessionsResult = {
  sessions: Session[];
  error: string | null;
  demo: boolean;
};

/** جلب جدول sessions للموقع العام (مفتاح anon) — بدون كاش على الصفحات force-dynamic */
export async function fetchPublicSessions(): Promise<FetchPublicSessionsResult> {
  try {
    const { data, error } = await supabase.from('sessions').select('*').order('date', { ascending: true });

    if (error) {
      return {
        sessions: [],
        error: error.message || ar.errors.trip.dbSaveFailed,
        demo: false,
      };
    }

    return { sessions: (data ?? []) as Session[], error: null, demo: false };
  } catch (e) {
    const detail = e instanceof Error ? e.message : '';
    return {
      sessions: [],
      error: detail ? `${ar.errors.trip.dbConnection} (${detail})` : ar.errors.trip.dbConnection,
      demo: false,
    };
  }
}
