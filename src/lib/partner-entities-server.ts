import 'server-only';

import {
  mapCelebrityRow,
  mapExpertRow,
  mapLeaderRow,
  type CelebrityRecord,
  type ExpertRecord,
  type LeaderRecord,
} from '@/lib/partner-entities';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function isMissingTableError(message: string): boolean {
  return /leaders|experts|celebrities|influencers|schema cache|relation|does not exist|could not find the table/i.test(
    message,
  );
}

export async function fetchLeadersAdmin(
  admin: AdminClient,
): Promise<{ rows: LeaderRecord[]; error: string | null }> {
  const { data, error } = await admin
    .from('leaders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error.message ?? '')) return { rows: [], error: null };
    return { rows: [], error: error.message };
  }

  return {
    rows: (data ?? [])
      .map((row) => mapLeaderRow(row as Record<string, unknown>))
      .filter((row): row is LeaderRecord => row != null),
    error: null,
  };
}

export async function fetchExpertsAdmin(
  admin: AdminClient,
): Promise<{ rows: ExpertRecord[]; error: string | null }> {
  const { data, error } = await admin
    .from('experts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error.message ?? '')) return { rows: [], error: null };
    return { rows: [], error: error.message };
  }

  return {
    rows: (data ?? [])
      .map((row) => mapExpertRow(row as Record<string, unknown>))
      .filter((row): row is ExpertRecord => row != null),
    error: null,
  };
}

export async function fetchCelebritiesAdmin(
  admin: AdminClient,
): Promise<{ rows: CelebrityRecord[]; error: string | null }> {
  // SSOT: influencers (legacy fallback: celebrities)
  let result = await admin
    .from('influencers')
    .select('*')
    .order('created_at', { ascending: false });

  if (result.error && isMissingTableError(result.error.message ?? '')) {
    result = await admin
      .from('celebrities')
      .select('*')
      .order('created_at', { ascending: false });
  }

  if (result.error) {
    if (isMissingTableError(result.error.message ?? '')) return { rows: [], error: null };
    return { rows: [], error: result.error.message };
  }

  return {
    rows: (result.data ?? [])
      .map((row) => mapCelebrityRow(row as Record<string, unknown>))
      .filter((row): row is CelebrityRecord => row != null),
    error: null,
  };
}
